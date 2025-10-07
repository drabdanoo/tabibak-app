const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// ==== ROLE MANAGEMENT FUNCTIONS ====

// Set user role (admin only)
exports.setUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const adminClaim = context.auth.token.admin || false;
  if (!adminClaim) {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  const { uid, role } = data;
  
  if (!uid || !role) {
    throw new functions.https.HttpsError("invalid-argument", "Missing uid or role");
  }

  if (!["patient", "doctor", "admin"].includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid role. Must be patient, doctor, or admin");
  }

  try {
    const claims = {};
    claims[role] = true;
    
    await admin.auth().setCustomUserClaims(uid, claims);
    
    await db.collection("users").doc(uid).set({
      role: role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    functions.logger.info("Set role " + role + " for user " + uid);
    return { success: true, message: "User role set to " + role };
  } catch (error) {
    functions.logger.error("Error setting user role:", error);
    throw new functions.https.HttpsError("internal", "Failed to set user role");
  }
});

// Auto-assign patient role on user creation
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  try {
    const defaultRole = "patient";
    
    await admin.auth().setCustomUserClaims(user.uid, {
      patient: true
    });
    
    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      role: defaultRole,
      email: user.email || null,
      phoneNumber: user.phoneNumber || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    functions.logger.info("Auto-assigned patient role to new user: " + user.uid);
  } catch (error) {
    functions.logger.error("Error in onUserCreate:", error);
  }
});

// Get user roles (authenticated users only)
exports.getUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  try {
    const user = await admin.auth().getUser(context.auth.uid);
    const customClaims = user.customClaims || {};
    
    let role = "patient";
    if (customClaims.admin) role = "admin";
    else if (customClaims.doctor) role = "doctor";
    else if (customClaims.patient) role = "patient";

    return { 
      role: role,
      claims: customClaims,
      uid: context.auth.uid 
    };
  } catch (error) {
    functions.logger.error("Error getting user role:", error);
    throw new functions.https.HttpsError("internal", "Failed to get user role");
  }
});

// Promote user to doctor (admin only)
exports.promoteToDoctor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const adminClaim = context.auth.token.admin || false;
  if (!adminClaim) {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  const { uid, doctorInfo } = data;
  
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "Missing uid");
  }

  try {
    await admin.auth().setCustomUserClaims(uid, {
      doctor: true,
      patient: false,
      admin: false
    });
    
    const batch = db.batch();
    
    batch.set(db.collection("users").doc(uid), {
      role: "doctor",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    if (doctorInfo) {
      batch.set(db.collection("doctors").doc(uid), {
        ...doctorInfo,
        uid: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await batch.commit();

    functions.logger.info("Promoted user " + uid + " to doctor");
    return { success: true, message: "User promoted to doctor" };
  } catch (error) {
    functions.logger.error("Error promoting to doctor:", error);
    throw new functions.https.HttpsError("internal", "Failed to promote user");
  }
});

// ==== EXISTING APPOINTMENT FUNCTIONS ====

exports.reserveSlot = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  
  const { doctorId, date, slotId, payload } = data || {};
  if (!doctorId || !date || !slotId) throw new functions.https.HttpsError("invalid-argument", "Missing fields");
  
  const schedRef = db.collection("schedules").doc(doctorId).collection(date).doc("day");
  const apptRef = db.collection("appointments").doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(schedRef);
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Schedule not found");
    
    const day = snap.data() || {};
    const slots = day.slots || {};
    const slot = slots[slotId];
    if (!slot || slot.available === false) {
      throw new functions.https.HttpsError("failed-precondition", "Slot taken");
    }
    slots[slotId].available = false;
    slots[slotId].heldUntil = Date.now() + 2 * 60 * 1000;
    tx.update(schedRef, { slots });

    tx.set(apptRef, {
      id: apptRef.id,
      patientId: context.auth.uid,
      doctorId,
      date,
      slotId,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(payload || {}),
    });
  });

  return { ok: true, id: "reserved" };
});

exports.cleanupHolds = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
  const snapshots = await db.collection("schedules").get();
  const now = Date.now();
  const writes = [];

  for (const doc of snapshots.docs) {
    const subcols = await doc.ref.listCollections();
    for (const col of subcols) {
      const dayRef = col.doc("day");
      const daySnap = await dayRef.get();
      if (!daySnap.exists) continue;
      const day = daySnap.data() || {};
      const slots = day.slots || {};
      let changed = false;
      for (const [sid, slot] of Object.entries(slots)) {
        if (slot.heldUntil && slot.available === false && slot.heldUntil < now) {
          slots[sid].available = true;
          delete slots[sid].heldUntil;
          changed = true;
        }
      }
      if (changed) {
        writes.push(dayRef.set({ slots }, { merge: true }));
      }
    }
  }
  await Promise.all(writes);
});


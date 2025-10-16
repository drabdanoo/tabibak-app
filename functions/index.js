// -----------------------------------------------------------------------------
// Firebase Functions - LOCKED to v1 API (auth.user().onCreate works here)
// Node 20 compatible. Roles, App Check, user creation, booking, cleanup.
// -----------------------------------------------------------------------------

const functionsV1 = require("firebase-functions/v1"); // ✅ explicit v1
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function verifyAppCheck(context) {
  if (!context.app) {
    throw new functionsV1.https.HttpsError(
      "failed-precondition",
      "The function must be called from an App Check verified app."
    );
  }
  return true;
}

async function setExclusiveRoleClaims(uid, role) {
  await admin.auth().setCustomUserClaims(uid, {
    admin: role === "admin",
    doctor: role === "doctor",
    patient: role === "patient",
  });
}

function resolveRole(claims = {}) {
  if (claims.admin) return "admin";
  if (claims.doctor) return "doctor";
  return "patient";
}

function generateInitials(fullName) {
  if (!fullName) return "د.م";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) return `د.${parts[1].charAt(0)}`;
  return `د.${parts[0].charAt(0)}`;
}

// -----------------------------------------------------------------------------
// USER CREATION TRIGGER (1st gen)
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// USER CREATION TRIGGER – assigns "patient" only for phone sign-ups
// -----------------------------------------------------------------------------

exports.onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  try {
    // Detect if the account was created by phone authentication
    const providerIds = (user.providerData || []).map((p) => p.providerId);
    const isPhoneSignup =
      !!user.phoneNumber || providerIds.includes("phone");

    // Check existing claims on the new user
    const userRecord = await admin.auth().getUser(user.uid);
    const existing = userRecord.customClaims || {};

    // Auto-assign patient only for phone sign-ups with no role yet
    if (
      isPhoneSignup &&
      !existing.admin &&
      !existing.doctor &&
      !existing.patient
    ) {
      await admin.auth().setCustomUserClaims(user.uid, {
        admin: false,
        doctor: false,
        patient: true,
      });
      logger.info(`Auto-assigned patient role (phone signup) to ${user.uid}`);
    } else {
      logger.info(
        `Skipping auto-patient for ${user.uid} (providers=${providerIds.join(
          ","
        )}, email=${user.email || "none"})`
      );
    }

    // Determine final role and record it in Firestore
    const finalRecord = await admin.auth().getUser(user.uid);
    const claims = finalRecord.customClaims || {};
    const role =
      claims.admin
        ? "admin"
        : claims.doctor
        ? "doctor"
        : claims.patient
        ? "patient"
        : "patient";

    await db.collection("users").doc(user.uid).set(
      {
        uid: user.uid,
        role,
        email: user.email || null,
        phoneNumber: user.phoneNumber || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    logger.error("Error in onUserCreate:", error);
  }
});


// -----------------------------------------------------------------------------
// ROLE MANAGEMENT (Callables)
// -----------------------------------------------------------------------------

exports.setDoctorClaim = functionsV1.https.onCall(async (data, context) => {
  verifyAppCheck(context);
  if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Must be authenticated");
  if (context.auth.token.admin !== true)
    throw new functionsV1.https.HttpsError("permission-denied", "Must be admin to set doctor claim");

  const email = data && data.email;
  if (!email) throw new functionsV1.https.HttpsError("invalid-argument", "Email is required");

  try {
    const user = await admin.auth().getUserByEmail(email);
    await setExclusiveRoleClaims(user.uid, "doctor");
    await db.collection("users").doc(user.uid).set(
      { role: "doctor", updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    logger.info(`Set doctor claim for ${email}`);
    return { success: true, message: `User ${email} has been made a doctor.` };
  } catch (error) {
    logger.error("Error setting doctor claim:", error);
    throw new functionsV1.https.HttpsError("internal", error.message);
  }
});

exports.setUserRole = functionsV1.https.onCall(async (data, context) => {
  verifyAppCheck(context);
  if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Must be authenticated");
  if (context.auth.token.admin !== true)
    throw new functionsV1.https.HttpsError("permission-denied", "Must be admin");

  const uid = data && data.uid;
  const role = data && data.role;
  if (!uid || !role) throw new functionsV1.https.HttpsError("invalid-argument", "Missing uid or role");
  if (!["patient", "doctor", "admin"].includes(role))
    throw new functionsV1.https.HttpsError("invalid-argument", "Invalid role");

  try {
    await setExclusiveRoleClaims(uid, role);
    await db.collection("users").doc(uid).set(
      { role, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    logger.info(`Set role ${role} for user ${uid}`);
    return { success: true, message: `User role set to ${role}` };
  } catch (error) {
    logger.error("Error setting user role:", error);
    throw new functionsV1.https.HttpsError("internal", "Failed to set user role");
  }
});

exports.getUserRole = functionsV1.https.onCall(async (data, context) => {
  verifyAppCheck(context);
  if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Must be authenticated");

  try {
    const user = await admin.auth().getUser(context.auth.uid);
    const customClaims = user.customClaims || {};
    const role = resolveRole(customClaims);
    return { role, claims: customClaims, uid: context.auth.uid };
  } catch (error) {
    logger.error("Error getting user role:", error);
    throw new functionsV1.https.HttpsError("internal", "Failed to get user role");
  }
});

// -----------------------------------------------------------------------------
// ADMIN (create/promote/delete)
// -----------------------------------------------------------------------------

exports.promoteToDoctor = functionsV1.https.onCall(async (data, context) => {
  verifyAppCheck(context);
  if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Must be authenticated");
  if (context.auth.token.admin !== true)
    throw new functionsV1.https.HttpsError("permission-denied", "Must be admin");

  const uid = data && data.uid;
  const doctorInfo = data && data.doctorInfo;
  if (!uid) throw new functionsV1.https.HttpsError("invalid-argument", "Missing uid");

  try {
    await setExclusiveRoleClaims(uid, "doctor");

    const batch = db.batch();
    batch.set(
      db.collection("users").doc(uid),
      { role: "doctor", updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    if (doctorInfo) {
      batch.set(db.collection("doctors").doc(uid), {
        ...doctorInfo,
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    logger.info(`Promoted user ${uid} to doctor`);
    return { success: true, message: "User promoted to doctor" };
  } catch (error) {
    logger.error("Error promoting to doctor:", error);
    throw new functionsV1.https.HttpsError("internal", "Failed to promote user");
  }
});

exports.createDoctor = functionsV1.https.onCall(async (data, context) => {
  verifyAppCheck(context);
  if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Must be authenticated");
  if (context.auth.token.admin !== true)
    throw new functionsV1.https.HttpsError("permission-denied", "Must be admin");

  const {
    name,
    specialty,
    phone,
    email,
    password,
    fee,
    experience,
    rating,
    reviews,
    location,
    hours,
    education,
    languages,
    specializations,
    about,
  } = data || {};

  if (!name || !email || !password || !specialty)
    throw new functionsV1.https.HttpsError(
      "invalid-argument",
      "Missing required fields: name, email, password, specialty"
    );

  try {
    logger.info(`Creating doctor account for: ${email}`);

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
    });

    await setExclusiveRoleClaims(userRecord.uid, "doctor");

    const doctorData = {
      name,
      initials: generateInitials(name),
      specialty,
      phone: phone || "",
      email,
      fee: fee || "15",
      consultationFee: parseInt(fee || "15", 10) * 1000,
      experience: experience || "5+ سنوات خبرة",
      rating: rating || "4.5",
      reviews: reviews || "25",
      location: location || "العيادة الطبية",
      hours: hours || "9:00 ص - 5:00 م",
      education: education || "بكالوريوس طب وجراحة",
      languages: languages || [],
      specializations: specializations || [],
      about: about || `طبيب متخصص في ${specialty} مع خبرة واسعة في المجال الطبي.`,
      uid: userRecord.uid,
      userId: userRecord.uid,
      accountStatus: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("doctors").doc(userRecord.uid).set(doctorData);
    await db.collection("users").doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        role: "doctor",
        email,
        name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info(`Doctor profile created successfully: ${name}`);
    return { success: true, message: `Doctor ${name} created successfully`, userId: userRecord.uid };
  } catch (error) {
    logger.error("Error creating doctor:", error);
    throw new functionsV1.https.HttpsError("internal", "Failed to create doctor: " + error.message);
  }
});

exports.deleteUser = functionsV1.https.onCall(async (data, context) => {
  verifyAppCheck(context);
  if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Must be authenticated");
  if (context.auth.token.admin !== true)
    throw new functionsV1.https.HttpsError("permission-denied", "Must be admin");

  const userId = data && data.userId;
  const userEmail = data && data.userEmail;
  if (!userId) throw new functionsV1.https.HttpsError("invalid-argument", "Missing userId");

  try {
    await admin.auth().deleteUser(userId);
    const batch = db.batch();
    batch.delete(db.collection("users").doc(userId));
    batch.delete(db.collection("doctors").doc(userId));

    const appt1 = await db.collection("appointments").where("patientId", "==", userId).get();
    appt1.forEach((doc) => batch.delete(doc.ref));

    const appt2 = await db.collection("appointments").where("doctorId", "==", userId).get();
    appt2.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
    logger.info(`Deleted user ${userId}`);
    return { success: true, message: `User ${userEmail || userId} deleted` };
  } catch (error) {
    logger.error("Error deleting user:", error);
    throw new functionsV1.https.HttpsError("internal", "Failed to delete user: " + error.message);
  }
});

// -----------------------------------------------------------------------------
// BOOKING
// -----------------------------------------------------------------------------

exports.reserveSlot = functionsV1.https.onCall(async (data, context) => {
  verifyAppCheck(context);
  if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Login required");

  const { doctorId, date, slotId, payload } = data || {};
  if (!doctorId || !date || !slotId)
    throw new functionsV1.https.HttpsError("invalid-argument", "Missing fields");

  const schedRef = db.collection("schedules").doc(doctorId).collection(date).doc("day");
  const apptRef = db.collection("appointments").doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(schedRef);
    if (!snap.exists) throw new functionsV1.https.HttpsError("not-found", "Schedule not found");

    const day = snap.data() || {};
    const slots = day.slots || {};
    const slot = slots[slotId];
    if (!slot || slot.available === false)
      throw new functionsV1.https.HttpsError("failed-precondition", "Slot taken");

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

// every 5 minutes (requires billing for scheduler)
exports.cleanupHolds = functionsV1.pubsub.schedule("every 5 minutes").onRun(async () => {
  const root = await db.collection("schedules").get();
  const now = Date.now();
  const writes = [];

  for (const doc of root.docs) {
    const subcols = await doc.ref.listCollections();
    for (const col of subcols) {
      const dayRef = col.doc("day");
      const daySnap = await dayRef.get();
      if (!daySnap.exists) continue;

      const day = daySnap.data() || {};
      const slots = day.slots || {};
      let changed = false;

      for (const [sid, slot] of Object.entries(slots)) {
        if (slot && slot.heldUntil && slot.available === false && slot.heldUntil < now) {
          slots[sid].available = true;
          delete slots[sid].heldUntil;
          changed = true;
        }
      }

      if (changed) writes.push(dayRef.set({ slots }, { merge: true }));
    }
  }

  await Promise.all(writes);
  logger.info(`cleanupHolds done. Updated ${writes.length} docs.`);
});

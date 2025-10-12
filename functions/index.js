const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// ==== APP CHECK VERIFICATION ====

// Helper function to verify App Check tokens
function verifyAppCheck(context) {
  // Check if App Check token is present
  if (!context.app) {
    throw new functions.https.HttpsError(
      "failed-precondition", 
      "The function must be called from an App Check verified app."
    );
  }
  return true;
}

// ==== ROLE MANAGEMENT FUNCTIONS ====

// Set user role (admin only)
exports.setUserRole = functions.https.onCall(async (data, context) => {
  // Verify App Check token first
  verifyAppCheck(context);
  
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

// Auto-assign patient role on user creation (only if no role already set)
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  try {
    // Check if user already has custom claims (e.g., set by CLI for doctors)
    const userRecord = await admin.auth().getUser(user.uid);
    const existingClaims = userRecord.customClaims || {};
    
    // Only set patient role if no role is already assigned
    if (!existingClaims.doctor && !existingClaims.admin && !existingClaims.patient) {
      const defaultRole = "patient";
      
      await admin.auth().setCustomUserClaims(user.uid, {
        patient: true
      });
      
      functions.logger.info(`Auto-assigned patient role to user ${user.uid}`);
    } else {
      functions.logger.info(`User ${user.uid} already has role assigned, skipping auto-assignment`);
    }
    
    // Always create/update the user document
    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      role: existingClaims.doctor ? "doctor" : (existingClaims.admin ? "admin" : "patient"),
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
  // Verify App Check token first
  verifyAppCheck(context);
  
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
  // Verify App Check token first
  verifyAppCheck(context);
  
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

// ==== USER MANAGEMENT FUNCTIONS ====

// Create doctor account with Firebase Auth and Firestore profile (admin only)
exports.createDoctor = functions.https.onCall(async (data, context) => {
  // Verify App Check token first
  verifyAppCheck(context);
  
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const adminClaim = context.auth.token.admin || false;
  if (!adminClaim) {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

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
    about
  } = data;
  
  if (!name || !email || !password || !specialty) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields: name, email, password, specialty");
  }

  try {
    functions.logger.info("Creating doctor account for: " + email);
    
    // Step 1: Create Firebase Auth account
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
      emailVerified: false // Will send verification email
    });
    
    functions.logger.info("Firebase Auth account created with UID: " + userRecord.uid);
    
    // Step 2: Send email verification
    try {
      const actionCodeSettings = {
        url: 'https://medconnect-2.web.app/doctor.html',
        handleCodeInApp: false
      };
      
      // Generate verification link
      const verificationLink = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);
      functions.logger.info("Email verification link generated successfully");
      
      // Note: Firebase Admin SDK generates the link but doesn't send emails automatically
      // The email will be sent via Firebase's email templates when the user tries to verify
      // Or you can integrate with an email service (SendGrid, etc.) to send the link
      
    } catch (emailError) {
      functions.logger.warn("Email verification setup warning:", emailError);
      // Continue with doctor creation even if email generation fails
    }
    
    // Step 3: Set doctor role
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      doctor: true,
      patient: false,
      admin: false
    });
    
    // Step 4: Generate initials
    const generateInitials = (fullName) => {
      if (!fullName) return 'د.م';
      const parts = fullName.split(' ');
      if (parts.length >= 2) {
        return `د.${parts[1].charAt(0)}`;
      }
      return `د.${parts[0].charAt(0)}`;
    };
    
    // Step 5: Create Firestore profile
    const doctorData = {
      name: name,
      initials: generateInitials(name),
      specialty: specialty,
      phone: phone || '',
      email: email,
      fee: fee || '15',
      consultationFee: parseInt(fee || '15') * 1000,
      experience: experience || '5+ سنوات خبرة',
      rating: rating || '4.5',
      reviews: reviews || '25',
      location: location || 'العيادة الطبية',
      hours: hours || '9:00 ص - 5:00 م',
      education: education || 'بكالوريوس طب وجراحة',
      languages: languages || [],
      specializations: specializations || [],
      about: about || `طبيب متخصص في ${specialty} مع خبرة واسعة في المجال الطبي.`,
      userId: userRecord.uid,
      accountStatus: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Add to doctors collection
    const doctorRef = await db.collection('doctors').add(doctorData);
    
    // Also add to users collection
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      role: 'doctor',
      email: email,
      name: name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    functions.logger.info("Doctor profile created successfully: " + name);
    
    return { 
      success: true, 
      message: `Doctor ${name} created successfully`,
      doctorId: doctorRef.id,
      userId: userRecord.uid,
      verificationNote: "Doctor can request verification email from login page"
    };
    
  } catch (error) {
    functions.logger.error("Error creating doctor:", error);
    
    // Cleanup on error - delete auth account if it was created
    try {
      if (error.code !== 'auth/email-already-exists') {
        // Try to find and delete the user if partially created
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.auth().deleteUser(userRecord.uid);
        functions.logger.info("Cleaned up partially created auth account");
      }
    } catch (cleanupError) {
      functions.logger.error("Cleanup error:", cleanupError);
    }
    
    throw new functions.https.HttpsError("internal", "Failed to create doctor: " + error.message);
  }
});

// Delete user account completely (admin only)
exports.deleteUser = functions.https.onCall(async (data, context) => {
  // Verify App Check token first
  verifyAppCheck(context);
  
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const adminClaim = context.auth.token.admin || false;
  if (!adminClaim) {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  const { userId, userEmail } = data;
  
  if (!userId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing userId");
  }

  try {
    // Delete from Firebase Authentication
    await admin.auth().deleteUser(userId);
    functions.logger.info("Deleted Firebase Auth user: " + userId);

    // Clean up related data in Firestore
    const batch = db.batch();
    
    // Delete from users collection
    batch.delete(db.collection("users").doc(userId));
    
    // If it's a doctor, also clean up doctor profile
    const doctorQuery = await db.collection("doctors").where("userId", "==", userId).get();
    doctorQuery.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete any appointments related to this user
    const appointmentsQuery = await db.collection("appointments").where("patientId", "==", userId).get();
    appointmentsQuery.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Also check for doctor appointments
    const doctorAppointmentsQuery = await db.collection("appointments").where("doctorId", "==", userId).get();
    doctorAppointmentsQuery.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    functions.logger.info("Cleaned up Firestore data for user: " + userId);

    return { 
      success: true, 
      message: `User ${userEmail || userId} completely deleted from Firebase Auth and Firestore` 
    };
  } catch (error) {
    functions.logger.error("Error deleting user:", error);
    throw new functions.https.HttpsError("internal", "Failed to delete user: " + error.message);
  }
});

// ==== EXISTING APPOINTMENT FUNCTIONS ====

exports.reserveSlot = functions.https.onCall(async (data, context) => {
  // Verify App Check token first
  verifyAppCheck(context);
  
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


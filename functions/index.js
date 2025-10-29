// -----------------------------------------------------------------------------
// Firebase Functions - LOCKED to v1 API (auth.user().onCreate works here)
// Node 20 compatible. Roles, App Check, user creation, booking, cleanup.
// -----------------------------------------------------------------------------

const functionsV1 = require("firebase-functions/v1"); // ✅ explicit v1
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
require('dotenv').config(); // Load .env file

// For local development
if (process.env.FIREBASE_PRIVATE_KEY) {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  // For production (Cloud Functions)
  admin.initializeApp();
}

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
// ROLE MANAGEMENT (Callables)
// -----------------------------------------------------------------------------

exports.setDoctorClaim = functionsV1.https.onCall(async (data, context) => {
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

exports.ensurePatientClaim = functionsV1.https.onCall(async (data, context) => {
  // App Check is optional for this function since it's called during phone verification
  // when App Check token might not be fully initialized yet
  if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "Must be authenticated");

  try {
    const user = await admin.auth().getUser(context.auth.uid);
    const customClaims = user.customClaims || {};
    
    // If user already has a role claim, don't override it
    if (customClaims.admin || customClaims.doctor || customClaims.patient) {
      logger.info(`User ${context.auth.uid} already has role claims:`, customClaims);
      return { success: true, claims: customClaims, message: "User already has role claims" };
    }
    
    // Set patient claim for phone-authenticated users without a role
    await admin.auth().setCustomUserClaims(context.auth.uid, { patient: true });
    logger.info(`Set patient claim for user ${context.auth.uid}`);
    
    // Ensure user document exists in Firestore
    await db.collection("users").doc(context.auth.uid).set({
      uid: context.auth.uid,
      role: "patient",
      phoneNumber: user.phoneNumber || null,
      email: user.email || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return { success: true, claims: { patient: true }, message: "Patient claim set successfully" };
  } catch (error) {
    logger.error("Error ensuring patient claim:", error);
    throw new functionsV1.https.HttpsError("internal", "Failed to ensure patient claim: " + error.message);
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
        uid: user.uid,
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

// -----------------------------------------------------------------------------
// NOTIFICATION TRIGGERS
// -----------------------------------------------------------------------------

/**
 * Sends an SMS notification to the patient when their appointment is confirmed.
 */
exports.onAppointmentConfirmed = functionsV1.firestore
  .document("appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if the status changed to 'confirmed'
    if (beforeData.status !== "confirmed" && afterData.status === "confirmed") {
      logger.info(`Appointment ${context.params.appointmentId} confirmed. Sending SMS.`);

      const patientPhone = afterData.patientPhone;
      const doctorName = afterData.doctorName;
      const appointmentDate = afterData.appointmentDate;
      const appointmentTime = afterData.appointmentTime;

      if (!patientPhone) {
        logger.error("No patient phone number found for this appointment.");
        return null;
      }

      // Initialize Twilio client from secure environment config
      const twilioConfig = functionsV1.config().twilio;
      const twilio = require("twilio");
      const client = new twilio(twilioConfig.sid, twilio.token);

      const message = `تم تأكيد موعدك مع ${doctorName} في تاريخ ${appointmentDate} الساعة ${appointmentTime}. - MedConnect`;

      return client.messages.create({
        body: message,
        to: `+964${patientPhone.substring(1)}`, // Assumes Iraqi number format 07...
        from: twilioConfig.phone_number,
      });
    }

    return null; // No action needed if status did not change to 'confirmed'
  });

/**
 * Sends an SMS to the patient when a doctor cancels their appointment.
 */
exports.onAppointmentCancelledByDoctor = functionsV1.firestore
  .document("appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if status changed to 'cancelled' AND it was done by a 'doctor'
    if (beforeData.status !== "cancelled" && afterData.status === "cancelled" && afterData.cancelledBy === "doctor") {
      logger.info(`Appointment ${context.params.appointmentId} cancelled by doctor. Sending SMS.`);

      const { patientPhone, doctorName, appointmentDate, appointmentTime, cancellationReason } = afterData;

      if (!patientPhone) {
        logger.error("No patient phone number found for this appointment.");
        return null;
      }

      const twilioConfig = functionsV1.config().twilio;
      const twilio = require("twilio");
      const client = new twilio(twilioConfig.sid, twilio.token);

      const message = `تم إلغاء موعدك مع ${doctorName} في تاريخ ${appointmentDate} الساعة ${appointmentTime}. السبب: "${cancellationReason}". نعتذر عن هذا الإزعاج. - MedConnect`;

      return client.messages.create({
        body: message,
        to: `+964${patientPhone.substring(1)}`, // Assumes Iraqi number format 07...
        from: twilioConfig.phone_number,
      });
    }
    return null;
  });

/**
 * Sends an SMS to the patient when their reschedule request is approved or denied.
 */
exports.onRescheduleResolved = functionsV1.firestore
  .document("appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if a reschedule request was just resolved (from 'reschedule_requested' to 'confirmed')
    if (beforeData.status === "reschedule_requested" && afterData.status === "confirmed") {
      const { patientPhone, doctorName } = afterData;

      if (!patientPhone) {
        logger.error(`No patient phone number for appointment ${context.params.appointmentId}, cannot send reschedule SMS.`);
        return null;
      }

      const twilioConfig = functionsV1.config().twilio;
      const twilio = require("twilio");
      const client = new twilio(twilioConfig.sid, twilio.token);
      let message;

      // Check if it was an approval (date or time changed)
      if (beforeData.appointmentDate !== afterData.appointmentDate || beforeData.appointmentTime !== afterData.appointmentTime) {
        logger.info(`Reschedule approved for ${context.params.appointmentId}. Sending approval SMS.`);
        message = `تمت الموافقة على طلب إعادة جدولة موعدك. موعدك الجديد مع ${doctorName} هو في تاريخ ${afterData.appointmentDate} الساعة ${afterData.appointmentTime}. - MedConnect`;
      } else {
        logger.info(`Reschedule denied for ${context.params.appointmentId}. Sending denial SMS.`);
        message = `تم رفض طلب إعادة جدولة موعدك مع ${doctorName}. يبقى موعدك الأصلي في تاريخ ${afterData.appointmentDate} الساعة ${afterData.appointmentTime}. - MedConnect`;
      }

      return client.messages.create({
        body: message,
        to: `+964${patientPhone.substring(1)}`, // Assumes Iraqi number format 07...
        from: twilioConfig.phone_number,
      });
    }
    return null;
  });

/**
 * Updates a doctor's average rating when a new rating is submitted.
 */
exports.onRatingCreate = functionsV1.firestore
  .document("ratings/{ratingId}")
  .onCreate(async (snap, context) => {
    const ratingData = snap.data();
    const doctorId = ratingData.doctorId;

    if (!doctorId) {
      logger.error("New rating is missing a doctorId.", { ratingId: context.params.ratingId });
      return null;
    }

    const doctorRef = db.collection("doctors").doc(doctorId);

    return db.runTransaction(async (transaction) => {
      const doctorDoc = await transaction.get(doctorRef);
      if (!doctorDoc.exists) {
        logger.error(`Doctor profile ${doctorId} not found for new rating.`);
        return null;
      }

      const doctorData = doctorDoc.data();
      const oldRating = parseFloat(doctorData.rating) || 0;
      const oldReviewsCount = parseInt(doctorData.reviews) || 0;

      // Calculate new average rating
      const newReviewsCount = oldReviewsCount + 1;
      const newRating = ((oldRating * oldReviewsCount) + ratingData.rating) / newReviewsCount;

      return transaction.update(doctorRef, {
        rating: newRating.toFixed(2), // Store with 2 decimal places
        reviews: newReviewsCount,
      });
    });
  });

// === SET RECEPTIONIST CLAIM ===
exports.setReceptionistClaim = functionsV1.https.onCall(async (data, context) => {
  const uid = data && data.uid;
  if (!uid) {
    throw new functionsV1.https.HttpsError('invalid-argument', 'User UID is required');
  }
  
  try {
    await admin.auth().setCustomUserClaims(uid, { receptionist: true });
    logger.info(`Set receptionist claim for user ${uid}`);
    return { success: true, message: `User ${uid} is now a receptionist` };
  } catch (error) {
    logger.error('Error setting receptionist claim:', error);
    throw new functionsV1.https.HttpsError('internal', error.message);
  }
});

// === SEND SMS CONFIRMATION ===
exports.sendAppointmentConfirmationSMS = functionsV1.https.onCall(async (data, context) => {
  const { patientPhone, patientName, doctorName, appointmentDate, appointmentTime } = data;
  
  logger.info('SMS request received:', { patientPhone, patientName, doctorName, appointmentDate, appointmentTime });
  
  if (!patientPhone || !patientName || !doctorName || !appointmentDate || !appointmentTime) {
    logger.error('Missing required fields');
    throw new functionsV1.https.HttpsError('invalid-argument', 'Missing required fields');
  }
  
  try {
    const twilio = require('twilio');
    const functions = require('firebase-functions');
    
    const accountSid = functions.config().twilio?.sid;
    const authToken = functions.config().twilio?.token;
    const phoneNumber = functions.config().twilio?.phone_number;
    
    logger.info('Twilio config check:', { hasSid: !!accountSid, hasToken: !!authToken, hasPhone: !!phoneNumber });
    
    if (!accountSid || !authToken || !phoneNumber) {
      logger.error('Twilio config not set', { accountSid: !!accountSid, authToken: !!authToken, phoneNumber: !!phoneNumber });
      throw new Error('Twilio credentials not configured');
    }
    
    // Validate patient phone number
    if (!patientPhone.startsWith('+')) {
      logger.error('Invalid phone number format:', patientPhone);
      throw new Error(`Phone number must start with +. Received: ${patientPhone}`);
    }
    
    const client = twilio(accountSid, authToken);
    
    const message = `مرحباً ${patientName}\n\nتم تأكيد موعدك مع د. ${doctorName}\nالتاريخ: ${appointmentDate}\nالوقت: ${appointmentTime}\n\nشكراً لاختيارك لنا - MedConnect`;
    
    logger.info('Sending SMS', { to: patientPhone, from: phoneNumber, messageLength: message.length });
    
    const result = await client.messages.create({
      body: message,
      from: phoneNumber,
      to: patientPhone
    });
    
    logger.info(`SMS sent successfully to ${patientPhone}`, { messageSid: result.sid });
    return { success: true, message: 'SMS sent successfully', messageSid: result.sid };
  } catch (error) {
    logger.error('Error sending SMS:', error.message, error);
    throw new functionsV1.https.HttpsError('internal', `SMS Error: ${error.message}`);
  }
});

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// Callable: reserve a slot atomically and create a pending appointment
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

// Scheduled cleanup of expired holds
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

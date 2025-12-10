const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Calculates the monthly revenue for a doctor.
 * This function runs on the server to ensure data integrity and security.
 * 
 * @param {object} data - The function arguments.
 * @param {object} context - The function execution context (auth).
 * @returns {object} - The calculated revenue.
 */
exports.calculateMonthlyRevenue = functions.https.onCall(async (data, context) => {
  // 1. Authentication Check
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const doctorId = context.auth.uid;
  
  // Optional: Check if the user is actually a doctor
  // const userSnapshot = await db.collection('users').doc(doctorId).get();
  // if (userSnapshot.data().role !== 'doctor') { ... }

  try {
    // 2. Date Range Calculation
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Convert to ISO strings for string comparison in Firestore (if dates are stored as strings)
    // Or use Firestore Timestamps if dates are stored as Timestamps.
    // Based on the client code, dates seem to be ISO strings or Timestamps.
    // We'll assume ISO strings for query consistency with the previous client code,
    // but robust code should handle both or enforce one.
    const startStr = startOfMonth.toISOString().split('T')[0];
    const endStr = endOfMonth.toISOString().split('T')[0];

    // 3. Database Query
    // We only select the 'fee' field to minimize data transfer and cost
    const appointmentsSnapshot = await db.collection("appointments")
      .where("doctorId", "==", doctorId)
      .where("status", "==", "Completed")
      .where("appointmentDate", ">=", startStr)
      .where("appointmentDate", "<=", endStr)
      .select("fee") // Optimization: Only fetch the fee field
      .get();

    // 4. Aggregation
    let totalRevenue = 0;
    appointmentsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fee && typeof data.fee === "number") {
        totalRevenue += data.fee;
      }
    });

    return {
      revenue: totalRevenue,
      currency: "IQD",
      period: {
        month: now.getMonth() + 1,
        year: now.getFullYear()
      }
    };

  } catch (error) {
    console.error("Error calculating revenue:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Unable to calculate revenue at this time."
    );
  }
});

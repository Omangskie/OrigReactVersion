import { getFirebaseAdmin } from "../_lib/firebaseAdmin.js";

const readBearerToken = (req) => {
  const authHeader = String(req.headers?.authorization || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authHeader.slice(7).trim();
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const actorToken = readBearerToken(req);
    const orderId = String(req.body?.orderId || "").trim();

    if (!actorToken) {
      return res.status(401).json({ message: "Missing bearer token." });
    }

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required." });
    }

    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(actorToken);
    const orderSnapshot = await adminDb.collection("orders").doc(orderId).get();

    if (!orderSnapshot.exists) {
      return res.status(404).json({ message: "Order not found." });
    }

    const order = orderSnapshot.data() || {};
    const cancellableStatuses = ["Pending Payment Approval", "Processing"];

    if (order.purchaserUid !== decoded.uid) {
      return res.status(403).json({ message: "You can only cancel your own order." });
    }

    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({ message: "This order can no longer be cancelled." });
    }

    await adminDb.collection("orders").doc(orderId).update({ status: "Cancelled" });

    return res.status(200).json({ ok: true, orderId, status: "Cancelled" });
  } catch (error) {
    const status = error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error" ? 401 : 500;
    return res.status(status).json({ message: error?.message || "Unable to cancel order." });
  }
}
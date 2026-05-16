import crypto from "crypto";
import { allowedAdminEmails, getFirebaseAdmin } from "../_lib/firebaseAdmin.js";

const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const isActiveAdmin = (profile = {}) => profile.role === "admin" && profile.status !== "deleted" && profile.status !== "suspended";

const parseDataUrl = (dataUrl) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) {
    throw new Error("Invalid showcase image payload.");
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const actorToken = String(req.body?.actorToken || "").trim();
    const fileName = String(req.body?.fileName || "showcase-image").trim();
    const dataUrl = String(req.body?.dataUrl || "").trim();

    if (!actorToken || !dataUrl) {
      return res.status(400).json({ message: "actorToken and dataUrl are required." });
    }

    const { auth: adminAuth, db: adminDb, storage } = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(actorToken);

    const actorDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const actorProfile = actorDoc.exists ? actorDoc.data() : null;
    const actorEmail = normalizeEmail(decoded.email || "");

    if (!isActiveAdmin(actorProfile) && !allowedAdminEmails.includes(actorEmail)) {
      return res.status(403).json({ message: "Only active admins can upload showcase items." });
    }

    const { buffer, contentType } = parseDataUrl(dataUrl);
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `showcase/${Date.now()}-${safeFileName}`;
    const file = storage.bucket().file(storagePath);
    const downloadToken = crypto.randomUUID();

    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.bucket().name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;

    const item = {
      category: String(req.body?.category || "").trim(),
      productId: String(req.body?.productId || "").trim(),
      productName: String(req.body?.productName || "").trim(),
      title: String(req.body?.title || "").trim(),
      description: String(req.body?.description || "").trim(),
      imageUrl,
      createdAt: new Date().toISOString(),
      createdBy: decoded.uid,
    };

    const docRef = await adminDb.collection("showcase").add(item);
    return res.status(200).json({ ok: true, id: docRef.id, item: { id: docRef.id, ...item } });
  } catch (error) {
    const status = error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error" ? 401 : 500;
    return res.status(status).json({ message: error?.message || "Unable to upload showcase image." });
  }
}

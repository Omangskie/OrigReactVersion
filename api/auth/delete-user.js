import { allowedAdminEmails, getFirebaseAdmin } from "../_lib/firebaseAdmin.js";

const isActiveAdmin = (profile = {}) => profile.role === "admin" && profile.status !== "deleted" && profile.status !== "suspended";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const targetUid = String(req.body?.targetUid || "").trim();
    const actorToken = String(req.body?.actorToken || "").trim();

    if (!targetUid || !actorToken) {
      return res.status(400).json({ message: "targetUid and actorToken are required." });
    }

    const { auth, db } = getFirebaseAdmin();
    const decoded = await auth.verifyIdToken(actorToken);

    const actorProfileRef = db.collection("users").doc(decoded.uid);
    const actorProfileSnapshot = await actorProfileRef.get();
    const actorProfile = actorProfileSnapshot.exists ? actorProfileSnapshot.data() : null;
    const actorEmail = String(decoded.email || "").toLowerCase();

    const canDeleteUser = isActiveAdmin(actorProfile) || allowedAdminEmails.includes(actorEmail);

    if (!canDeleteUser) {
      return res.status(403).json({ message: "Only active admins can delete user accounts." });
    }

    if (decoded.uid === targetUid) {
      return res.status(400).json({ message: "Admins cannot delete their own account from this endpoint." });
    }

    await auth.deleteUser(targetUid);
    return res.status(200).json({ ok: true, deletedUid: targetUid });
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      return res.status(200).json({ ok: true, alreadyDeleted: true });
    }

    return res.status(500).json({
      message: error?.message || "Failed to delete Firebase Authentication user.",
    });
  }
}

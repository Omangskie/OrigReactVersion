import { allowedAdminEmails, getFirebaseAdmin } from "../_lib/firebaseAdmin.js";

const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const nowIso = () => new Date().toISOString();

const isActiveAdmin = (profile = {}) => profile.role === "admin" && profile.status !== "deleted" && profile.status !== "suspended";

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
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "").trim();
    const requestedRole = String(req.body?.role || "admin").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Please provide a valid admin email address." });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long." });
    }

    if (requestedRole !== "admin") {
      return res.status(400).json({ message: "This endpoint only creates admin accounts." });
    }

    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();

    let canCreateAdmin = false;
    let createdBy = "";

    if (actorToken) {
      const decoded = await adminAuth.verifyIdToken(actorToken);
      const actorProfileSnapshot = await adminDb.collection("users").doc(decoded.uid).get();
      const actorProfile = actorProfileSnapshot.exists ? actorProfileSnapshot.data() : null;
      const actorEmail = normalizeEmail(decoded.email || "");
      canCreateAdmin = isActiveAdmin(actorProfile) || allowedAdminEmails.includes(actorEmail);
      createdBy = decoded.uid;
    } else {
      const existingAdmins = await adminDb.collection("users").where("role", "==", "admin").limit(1).get();
      canCreateAdmin = existingAdmins.empty || allowedAdminEmails.includes(email);
      createdBy = "bootstrap";
    }

    if (!canCreateAdmin) {
      return res.status(403).json({ message: "Only active admins can create admin accounts." });
    }

    const existingAuthUser = await adminAuth.getUserByEmail(email).catch((error) => {
      if (error?.code === "auth/user-not-found") {
        return null;
      }
      throw error;
    });

    if (existingAuthUser) {
      return res.status(409).json({ message: "An account already exists for this email address." });
    }

    const createdUser = await adminAuth.createUser({
      email,
      password,
      displayName: "admin",
      emailVerified: false,
      disabled: false,
    });

    const profile = {
      uid: createdUser.uid,
      email,
      phone: "",
      role: "admin",
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy,
    };

    await adminDb.collection("users").doc(createdUser.uid).set(profile, { merge: true });

    return res.status(200).json({ ok: true, uid: createdUser.uid, profile });
  } catch (error) {
    const status = error?.code === "auth/email-already-exists" ? 409 : 500;
    return res.status(status).json({ message: error?.message || "Unable to create admin account." });
  }
}

import { allowedAdminEmails, getFirebaseAdmin } from "../_lib/firebaseAdmin.js";

const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const nowIso = () => new Date().toISOString();

const normalizeProfile = (uid, authUser = {}, profile = {}) => ({
  uid,
  email: profile.email || authUser.email || "",
  phone: profile.phone || authUser.phoneNumber || "",
  role: profile.role || "customer",
  status: profile.status || "active",
  createdAt: profile.createdAt || nowIso(),
  updatedAt: profile.updatedAt || nowIso(),
});

const isActiveAdmin = (profile = {}) => profile.role === "admin" && profile.status !== "deleted" && profile.status !== "suspended";

const readBearerToken = (req) => {
  const authHeader = String(req.headers?.authorization || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authHeader.slice(7).trim();
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const actorToken = readBearerToken(req);
    if (!actorToken) {
      return res.status(401).json({ message: "Missing bearer token." });
    }

    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(actorToken);

    const actorProfileSnapshot = await adminDb.collection("users").doc(decoded.uid).get();
    const actorProfile = actorProfileSnapshot.exists ? actorProfileSnapshot.data() : null;
    const actorEmail = normalizeEmail(decoded.email || "");
    const canReadUsers = isActiveAdmin(actorProfile) || allowedAdminEmails.includes(actorEmail);

    if (!canReadUsers) {
      return res.status(403).json({ message: "Only active admins can view users." });
    }

    const profileSnapshot = await adminDb.collection("users").get();
    const profileByUid = new Map();
    profileSnapshot.forEach((doc) => {
      profileByUid.set(doc.id, doc.data() || {});
    });

    // Pull from Firebase Authentication so counts are sourced from Firebase, not local state.
    const authUsersPage = await adminAuth.listUsers(1000);
    const users = authUsersPage.users.map((authUser) => {
      const profile = profileByUid.get(authUser.uid) || {};
      profileByUid.delete(authUser.uid);
      return normalizeProfile(authUser.uid, authUser, profile);
    });

    // Include any profile docs that do not yet have a matching auth record in this page.
    profileByUid.forEach((profile, uid) => {
      users.push(normalizeProfile(uid, {}, profile));
    });

    users.sort((a, b) => {
      const ta = Date.parse(a.createdAt || "") || 0;
      const tb = Date.parse(b.createdAt || "") || 0;
      return tb - ta;
    });

    return res.status(200).json({ ok: true, users });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Unable to load users." });
  }
}

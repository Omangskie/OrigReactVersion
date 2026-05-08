import { paymongoKeyMode, paymongoSecretKey } from "./_lib/paymongo.js";

const hasFirebaseServiceAccountJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
const hasFirebaseProjectId = Boolean(process.env.FIREBASE_PROJECT_ID?.trim());
const hasFirebaseClientEmail = Boolean(process.env.FIREBASE_CLIENT_EMAIL?.trim());
const hasFirebasePrivateKey = Boolean(process.env.FIREBASE_PRIVATE_KEY?.trim());

export default function handler(_req, res) {
  const firebaseAdminConfigured = hasFirebaseServiceAccountJson ||
    (hasFirebaseProjectId && hasFirebaseClientEmail && hasFirebasePrivateKey);

  return res.status(200).json({
    ok: true,
    paymongoConfigured: Boolean(paymongoSecretKey),
    paymongoKeyMode,
    firebaseAdminConfigured,
    firebaseAdminEnv: {
      hasFirebaseServiceAccountJson,
      hasFirebaseProjectId,
      hasFirebaseClientEmail,
      hasFirebasePrivateKey,
    },
    runtime: "vercel-function",
  });
}

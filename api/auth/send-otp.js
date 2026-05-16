import { getFirebaseAdmin } from "../_lib/firebaseAdmin.js";
import { createOtpRecord, generateOtpCode, normalizeEmail, sendBrevoOtpEmail } from "../_lib/otpService.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const email = normalizeEmail(req.body?.email);

    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }

    const { auth, db } = getFirebaseAdmin();

    // If caller indicates this is a signup flow, do NOT require an existing account.
    const action = String(req.body?.action || req.query?.action || req.query?.mode || '').toLowerCase();
    const isSignupFlow = action === 'signup';

    if (!isSignupFlow) {
      try {
        await auth.getUserByEmail(email);
      } catch (error) {
        if (error?.code === "auth/user-not-found") {
          return res.status(404).json({ message: "No account found with this email address." });
        }

        throw error;
      }
    }

    const code = generateOtpCode();
    const otpRef = db.collection("password_reset_otps").doc(email);
    await otpRef.set(createOtpRecord(email, code));

    try {
      await sendBrevoOtpEmail(email, code);
    } catch (error) {
      await otpRef.delete().catch(() => {});

      if (error?.status === 401) {
        return res.status(503).json({
          message:
            "Brevo rejected the API key with 401 Unauthorized. Check the Brevo API key or sender configuration.",
          details: error?.details || error?.message || null,
        });
      }

      return res.status(500).json({ message: error?.message || "Failed to send verification code." });
    }

    return res.status(200).json({ ok: true, message: `Verification code sent to ${email}.`, email });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to send verification code." });
  }
}
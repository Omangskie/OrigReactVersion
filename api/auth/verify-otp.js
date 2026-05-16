import { getFirebaseAdmin } from "../_lib/firebaseAdmin.js";
import {
  createResetTokenRecord,
  generateResetToken,
  hasExceededMaxAttempts,
  isOtpExpired,
  normalizeEmail,
} from "../_lib/otpService.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();

    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }

    if (!code) {
      return res.status(400).json({ message: "Please provide the verification code." });
    }

    const { auth, db } = getFirebaseAdmin();

    // Allow verify for signup flows: when action=signup skip existing-account check
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

    const otpRef = db.collection("password_reset_otps").doc(email);
    const otpSnapshot = await otpRef.get();

    if (!otpSnapshot.exists) {
      return res.status(400).json({ message: "No active verification request found. Please request a new code." });
    }

    const otpRecord = otpSnapshot.data();

    if (isOtpExpired(otpRecord)) {
      await otpRef.delete();
      return res.status(400).json({ message: "The verification code has expired. Please request a new one." });
    }

    if (hasExceededMaxAttempts(otpRecord)) {
      await otpRef.delete();
      return res.status(429).json({ message: "Too many incorrect attempts. Please request a new verification code." });
    }

    if (String(otpRecord?.code || "") !== code) {
      const nextAttempts = (otpRecord.attempts || 0) + 1;
      await otpRef.update({ attempts: nextAttempts });
      return res.status(400).json({ message: `Invalid verification code. ${Math.max((otpRecord.maxAttempts || 5) - nextAttempts, 0)} attempt(s) remaining.` });
    }

    const resetToken = generateResetToken();
    await db.collection("password_reset_tokens").doc(resetToken).set(createResetTokenRecord(email, resetToken));
    await otpRef.update({ verified: true, resetToken });

    return res.status(200).json({ ok: true, message: "Verification succeeded.", resetToken, email });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to verify code." });
  }
}
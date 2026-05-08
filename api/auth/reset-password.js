import { getFirebaseAdmin } from "../_lib/firebaseAdmin.js";
import { isResetTokenExpired, normalizeEmail } from "../_lib/otpService.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const email = normalizeEmail(req.body?.email);
    const resetToken = String(req.body?.resetToken || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }

    if (!resetToken) {
      return res.status(400).json({ message: "Your reset session expired. Please verify the OTP again." });
    }

    if (!password) {
      return res.status(400).json({ message: "Please provide a new password." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password is too weak. Use at least 6 characters." });
    }

    const { auth, db } = getFirebaseAdmin();
    const tokenRef = db.collection("password_reset_tokens").doc(resetToken);
    const tokenSnapshot = await tokenRef.get();

    if (!tokenSnapshot.exists) {
      return res.status(400).json({ message: "Invalid or expired password reset token. Please verify the OTP again." });
    }

    const tokenRecord = tokenSnapshot.data();

    if (tokenRecord.email !== email) {
      return res.status(400).json({ message: "Reset token does not match the provided email address." });
    }

    if (tokenRecord.used) {
      return res.status(400).json({ message: "This reset session has already been used. Please request a new one." });
    }

    if (isResetTokenExpired(tokenRecord)) {
      await tokenRef.delete();
      return res.status(400).json({ message: "Your reset session has expired. Please verify the OTP again." });
    }

    const userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password });
    await auth.revokeRefreshTokens(userRecord.uid);
    await tokenRef.update({ used: true, usedAt: new Date().toISOString() });

    await db.collection("password_reset_otps").doc(email).delete().catch(() => {});

    return res.status(200).json({ ok: true, message: "Password updated successfully." });
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      return res.status(404).json({ message: "No account found with this email address." });
    }

    return res.status(500).json({ message: error?.message || "Failed to reset password." });
  }
}
import crypto from "node:crypto";

const BREVO_API_KEY = process.env.BREVO_API_KEY?.trim();
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME?.trim() || "Originals Printing";
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL?.trim() || "noreply@originalsprinting.local";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

export const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

export const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

export const generateResetToken = () => crypto.randomBytes(24).toString("hex");

export const createOtpRecord = (email, code) => ({
  email,
  code,
  attempts: 0,
  maxAttempts: 5,
  verified: false,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
});

export const createResetTokenRecord = (email, resetToken) => ({
  email,
  resetToken,
  used: false,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
});

export const isOtpExpired = (record) => !record?.expiresAt || Date.now() > new Date(record.expiresAt).getTime();

export const isResetTokenExpired = (record) => !record?.expiresAt || Date.now() > new Date(record.expiresAt).getTime();

export const hasExceededMaxAttempts = (record) => (record?.attempts || 0) >= (record?.maxAttempts || 5);

export const sendBrevoOtpEmail = async (email, code) => {
  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not configured on the server.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email }],
      subject: "Your Originals Printing verification code",
      htmlContent: `<html><body><p>Your Originals Printing verification code is <strong>${code}</strong>.</p><p>This code expires in 5 minutes.</p><p>If you did not request this, you can ignore this message.</p></body></html>`,
      textContent: `Your Originals Printing verification code is ${code}. This code expires in 5 minutes. If you did not request this, you can ignore this message.`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Brevo request failed: ${response.status} ${body}`);
    error.status = response.status;
    error.details = body;
    throw error;
  }

  return response.json();
};
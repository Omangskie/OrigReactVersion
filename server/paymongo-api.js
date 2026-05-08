import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { allowedAdminEmails, getFirebaseAdmin } from './firebaseAdmin.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const paymentSessions = new Map();
const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY?.trim();

app.use(cors());
app.use(express.json({
  // Allow larger JSON payloads because the client sends base64 data URLs for images.
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

// Also accept larger URL-encoded bodies if ever used by forms.
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const paymongoBaseUrl = 'https://api.paymongo.com/v1';
const paymongoKeyMode = paymongoSecretKey?.startsWith('sk_live_') ? 'live' : paymongoSecretKey?.startsWith('sk_test_') ? 'test' : 'unknown';
const paymongoWebhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim();

const otpStore = new Map();
const passwordResetTokens = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const BREVO_API_KEY = process.env.BREVO_API_KEY?.trim();
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME?.trim() || 'Originals Printing';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL?.trim() || 'noreply@originalsprinting.local';

const normalizeEmail = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateResetToken = () => crypto.randomBytes(24).toString('hex');
const isActiveAdmin = (profile = {}) => profile.role === 'admin' && profile.status !== 'deleted' && profile.status !== 'suspended';
const maskEmail = (email) => {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) {
    return 'your email';
  }

  if (local.length <= 2) {
    return `${local[0] || '*'}*@${domain}`;
  }

  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
};

const sendBrevoOtpEmail = async (email, code) => {
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not configured.');
  }

  const payload = {
    sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
    to: [{ email }],
    subject: 'Your Originals Printing verification code',
    htmlContent: `<html><body><p>Your Originals verification code is <strong>${code}</strong>.</p><p>This code expires in 5 minutes.</p></body></html>`,
    textContent: `Your Originals verification code is ${code}. This code expires in 5 minutes.`,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
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

const createAuthorizationHeader = () => {
  if (!paymongoSecretKey) {
    return '';
  }

  return `Basic ${Buffer.from(`${paymongoSecretKey}:`).toString('base64')}`;
};

const parsePaymongoError = async (response) => {
  try {
    const payload = await response.json();
    const details = payload?.errors?.[0]?.detail || payload?.errors?.[0]?.message || payload?.message;
    return details || `PayMongo request failed with HTTP ${response.status}`;
  } catch {
    return `PayMongo request failed with HTTP ${response.status}`;
  }
};

const parsePaymongoSignature = (signatureHeader) => {
  if (!signatureHeader) {
    return null;
  }

  return signatureHeader.split(',').reduce((result, part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      result[key.trim()] = value.trim();
    }
    return result;
  }, {});
};

const verifyWebhookSignature = (req, body) => {
  if (!paymongoWebhookSecret) {
    return { ok: true, reason: 'Webhook secret not configured.' };
  }

  const header = req.get('Paymongo-Signature');
  const signatureParts = parsePaymongoSignature(header);
  if (!signatureParts?.t || !signatureParts?.te || !signatureParts?.li) {
    return { ok: false, reason: 'Missing or malformed Paymongo-Signature header.' };
  }

  const livemode = Boolean(body?.data?.attributes?.livemode ?? body?.livemode);
  const expectedSignature = livemode ? signatureParts.li : signatureParts.te;
  const payload = `${signatureParts.t}.${req.rawBody || ''}`;
  const computedSignature = crypto.createHmac('sha256', paymongoWebhookSecret).update(payload).digest('hex');

  if (computedSignature !== expectedSignature) {
    return { ok: false, reason: 'Webhook signature verification failed.' };
  }

  return { ok: true };
};

const requestPaymongo = async (path, body) => {
  if (!paymongoSecretKey) {
    throw new Error('PAYMONGO_SECRET_KEY is missing. Add it to .env before starting the API.');
  }

  const response = await fetch(`${paymongoBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: createAuthorizationHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = new Error(await parsePaymongoError(response));
    error.statusCode = response.status >= 500 ? 502 : 400;
    throw error;
  }

  return response.json();
};

const retrievePaymentIntent = async (paymentIntentId) => {
  const response = await fetch(`${paymongoBaseUrl}/payment_intents/${paymentIntentId}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: createAuthorizationHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await parsePaymongoError(response));
  }

  return response.json();
};

const normalizeAmountToCentavos = (amount) => Math.max(1, Math.round(Number(amount) * 100));

const computeAmountFromCart = (cartItems) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return 0;
  }

  return cartItems.reduce((sum, item) => {
    const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
    const unitPrice = Number(item?.itemPrice ?? item?.product?.price ?? 0);

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return sum;
    }

    return sum + (unitPrice * quantity);
  }, 0);
};

const generateReference = () => `ORIG-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

const extractWebhookReference = (event) => {
  const payload = event?.data?.attributes?.data ?? event?.data?.attributes?.payload ?? event?.data?.attributes?.resource ?? event?.data;
  return (
    payload?.attributes?.metadata?.reference ||
    payload?.attributes?.reference ||
    payload?.metadata?.reference ||
    payload?.reference ||
    payload?.attributes?.description ||
    null
  );
};

const mapWebhookStatus = (eventType, currentStatus) => {
  const normalizedType = String(eventType || '').toLowerCase();

  if (normalizedType.includes('paid') || normalizedType.includes('succeeded')) {
    return 'paid';
  }

  if (normalizedType.includes('expired') || normalizedType.includes('failed') || normalizedType.includes('canceled')) {
    return 'expired';
  }

  return currentStatus || 'waiting';
};

const mapPaymentIntentStatus = (status) => {
  if (status === 'succeeded' || status === 'paid') {
    return 'paid';
  }

  if (status === 'expired' || status === 'canceled') {
    return 'expired';
  }

  return 'waiting';
};

const createOrderId = () => `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

const parseDataUrl = (dataUrl) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(dataUrl || '');

  if (!match) {
    throw new Error('Invalid receipt proof image.');
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
};

const uploadPaymentProof = async ({ storage, purchaserUid, orderId, fileName, proofImage }) => {
  if (!proofImage) {
    return { proofImageUrl: '', proofStoragePath: '' };
  }

  if (!proofImage.startsWith('data:image/')) {
    return { proofImageUrl: proofImage, proofStoragePath: '' };
  }

  const safeFileName = String(fileName || 'receipt-proof').replace(/[^a-zA-Z0-9._-]/g, '_');
  const proofStoragePath = `order-receipts/${purchaserUid}/${orderId}/${Date.now()}-${safeFileName}`;
  const { buffer, contentType } = parseDataUrl(proofImage);
  const receiptFile = storage.bucket().file(proofStoragePath);
  const downloadToken = crypto.randomUUID();

  await receiptFile.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  return {
    proofImageUrl: `https://firebasestorage.googleapis.com/v0/b/${storage.bucket().name}/o/${encodeURIComponent(proofStoragePath)}?alt=media&token=${downloadToken}`,
    proofStoragePath,
  };
};

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    paymongoConfigured: Boolean(paymongoSecretKey),
    paymongoKeyMode,
    paymongoKeyPrefix: paymongoSecretKey ? paymongoSecretKey.slice(0, 7) : null,
    webhookConfigured: Boolean(paymongoWebhookSecret),
    brevoConfigured: Boolean(BREVO_API_KEY),
  });
});

app.post('/api/auth/send-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  const code = generateOtpCode();
  const expiresAt = Date.now() + OTP_TTL_MS;
  otpStore.set(email, { code, expiresAt, attemptsLeft: MAX_OTP_ATTEMPTS });

  if (!BREVO_API_KEY) {
    otpStore.delete(email);
    return res.status(500).json({ message: 'BREVO_API_KEY is not configured on the server.' });
  }

  try {
    await sendBrevoOtpEmail(email, code);
    return res.json({ ok: true, message: `Verification code sent to ${maskEmail(email)}.` });
  } catch (error) {
    console.error('Brevo OTP send error:', error);
    otpStore.delete(email);

    if (error?.status === 401) {
      return res.status(503).json({
        message:
          'Brevo rejected the API key with 401 Unauthorized. In Brevo, enable API keys for API usage or switch this flow to SMTP delivery.',
        details: error?.details || error?.message || null,
      });
    }

    return res.status(500).json({ message: error?.message || 'Failed to send verification code.' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '').trim();

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and verification code are required.' });
  }

  const record = otpStore.get(email);
  if (!record) {
    return res.status(400).json({ message: 'No active verification request found. Please request a new code.' });
  }

  if (record.expiresAt < Date.now()) {
    otpStore.delete(email);
    return res.status(400).json({ message: 'The verification code has expired. Please request a new one.' });
  }

  if (record.attemptsLeft <= 0) {
    otpStore.delete(email);
    return res.status(400).json({ message: 'Too many incorrect attempts. Please request a new verification code.' });
  }

  if (record.code !== code) {
    record.attemptsLeft -= 1;
    otpStore.set(email, record);
    return res.status(400).json({ message: `Invalid verification code. ${record.attemptsLeft} attempt(s) remaining.` });
  }

  otpStore.delete(email);
  const resetToken = generateResetToken();
  passwordResetTokens.set(resetToken, {
    email,
    expiresAt: Date.now() + PASSWORD_RESET_TOKEN_TTL_MS,
  });

  return res.json({ ok: true, message: 'Verification succeeded.', resetToken });
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const resetToken = String(req.body?.resetToken || '').trim();
    const newPassword = String(req.body?.password || '').trim();

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ message: 'Email, reset token, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password is too weak. Use at least 6 characters.' });
    }

    const tokenRecord = passwordResetTokens.get(resetToken);
    if (!tokenRecord || tokenRecord.email !== email) {
      return res.status(400).json({ message: 'Invalid or expired password reset token. Please verify the OTP again.' });
    }

    if (tokenRecord.expiresAt < Date.now()) {
      passwordResetTokens.delete(resetToken);
      return res.status(400).json({ message: 'Password reset session expired. Please verify the OTP again.' });
    }

    const { auth } = getFirebaseAdmin();
    const userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password: newPassword });
    await auth.revokeRefreshTokens(userRecord.uid);

    passwordResetTokens.delete(resetToken);

    return res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Failed to reset password.' });
  }
});

app.post('/api/auth/delete-user', async (req, res) => {
  try {
    const targetUid = String(req.body?.targetUid || '').trim();
    const actorToken = String(req.body?.actorToken || '').trim();

    if (!targetUid || !actorToken) {
      return res.status(400).json({ message: 'targetUid and actorToken are required.' });
    }

    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(actorToken);
    const actorProfileSnapshot = await adminDb.collection('users').doc(decoded.uid).get();
    const actorProfile = actorProfileSnapshot.exists ? actorProfileSnapshot.data() : null;
    const actorEmail = normalizeEmail(decoded.email || '');
    const canDeleteUser = isActiveAdmin(actorProfile) || allowedAdminEmails.includes(actorEmail);

    if (!canDeleteUser) {
      return res.status(403).json({ message: 'Only active admins can delete user accounts.' });
    }

    if (decoded.uid === targetUid) {
      return res.status(400).json({ message: 'Admins cannot delete their own account from this endpoint.' });
    }

    await adminAuth.deleteUser(targetUid);
    return res.status(200).json({ ok: true, deletedUid: targetUid });
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      return res.status(200).json({ ok: true, alreadyDeleted: true });
    }

    return res.status(500).json({ message: error?.message || 'Failed to delete Firebase Authentication user.' });
  }
});

app.post('/api/payments/webhook', async (req, res) => {
  const signatureCheck = verifyWebhookSignature(req, req.body);
  if (!signatureCheck.ok) {
    return res.status(400).json({ ok: false, message: signatureCheck.reason });
  }

  const eventType = req.body?.data?.attributes?.type || req.body?.data?.type || req.body?.type || '';
  const reference = extractWebhookReference(req.body);

  if (!reference) {
    return res.status(200).json({ ok: true, ignored: true, reason: 'No session reference found in webhook payload.' });
  }

  const session = paymentSessions.get(reference);
  if (!session) {
    return res.status(200).json({ ok: true, ignored: true, reason: `No active session for reference ${reference}.` });
  }

  const nextStatus = mapWebhookStatus(eventType, session.status);
  session.status = nextStatus;
  session.lastWebhookEvent = {
    type: eventType || 'unknown',
    receivedAt: new Date().toISOString(),
  };
  paymentSessions.set(reference, session);

  return res.status(200).json({ ok: true, reference, status: nextStatus });
});

app.post('/api/payments/session', async (req, res) => {
  const reference = typeof req.body?.reference === 'string' && req.body.reference.trim() ? req.body.reference.trim() : generateReference();
  const description = typeof req.body?.description === 'string' && req.body.description.trim() ? req.body.description.trim() : `Originals Printing order ${reference}`;
  const cartAmount = computeAmountFromCart(req.body?.cart);
  const requestedAmount = Number(req.body?.amount);
  const amount = cartAmount > 0 ? cartAmount : requestedAmount;

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Amount must be a positive number or computable from cart items.' });
  }

  if (!paymongoSecretKey) {
    return res.status(500).json({
      message: 'PAYMONGO_SECRET_KEY is missing.',
      hint: 'Add your PayMongo secret key to .env, then restart the API with npm run api.',
    });
  }

  const amountInCentavos = normalizeAmountToCentavos(amount);

  if (amountInCentavos < 100) {
    return res.status(400).json({
      message: 'Minimum PayMongo charge is PHP 1.00. Increase your order total to continue.',
      hint: 'Your current total is below PayMongo\'s minimum amount requirement.',
    });
  }

  const billing = {
    name: typeof req.body?.customerName === 'string' && req.body.customerName.trim() ? req.body.customerName.trim() : 'Originals Printing Customer',
    email: typeof req.body?.customerEmail === 'string' && req.body.customerEmail.trim() ? req.body.customerEmail.trim() : 'checkout@originalsprinting.local',
    phone: typeof req.body?.customerPhone === 'string' && req.body.customerPhone.trim() ? req.body.customerPhone.trim() : '',
    address: req.body?.customerAddress ? {
      line1: typeof req.body.customerAddress.line1 === 'string' ? req.body.customerAddress.line1.trim() : '',
      line2: typeof req.body.customerAddress.line2 === 'string' ? req.body.customerAddress.line2.trim() : '',
      city: typeof req.body.customerAddress.city === 'string' ? req.body.customerAddress.city.trim() : '',
      state: typeof req.body.customerAddress.state === 'string' ? req.body.customerAddress.state.trim() : '',
      postal_code: typeof req.body.customerAddress.postal_code === 'string' ? req.body.customerAddress.postal_code.trim() : '',
      country: typeof req.body.customerAddress.country === 'string' ? req.body.customerAddress.country.trim() : 'PH',
    } : undefined,
  };

  try {
    const paymentIntent = await requestPaymongo('/payment_intents', {
      data: {
        attributes: {
          amount: amountInCentavos,
          currency: 'PHP',
          payment_method_allowed: ['qrph'],
          description,
          statement_descriptor: 'ORIGINALS',
          metadata: {
            reference,
            source: 'checkout',
          },
        },
      },
    });

    const paymentIntentId = paymentIntent?.data?.id;
    if (!paymentIntentId) {
      throw new Error('PayMongo did not return a payment intent id.');
    }

    const paymentMethod = await requestPaymongo('/payment_methods', {
      data: {
        attributes: {
          type: 'qrph',
          billing,
        },
      },
    });

    const paymentMethodId = paymentMethod?.data?.id;
    if (!paymentMethodId) {
      throw new Error('PayMongo did not return a payment method id.');
    }

    const attachedPaymentIntent = await requestPaymongo(`/payment_intents/${paymentIntentId}/attach`, {
      data: {
        attributes: {
          payment_method: paymentMethodId,
        },
      },
    });

    const qrImageUrl = attachedPaymentIntent?.data?.attributes?.next_action?.code?.image_url || '';
    const expiresAt = Date.now() + 30 * 60 * 1000;

    paymentSessions.set(reference, {
      reference,
      amount,
      amountInCentavos,
      description,
      paymentIntentId,
      paymentMethodId,
      qrImageUrl,
      expiresAt,
      status: mapPaymentIntentStatus(attachedPaymentIntent?.data?.attributes?.status),
    });

    res.json({
      reference,
      amount,
      amountInCentavos,
      currency: 'PHP',
      paymongoKeyMode,
      paymentIntentId,
      paymentMethodId,
      qrImageUrl,
      checkoutUrl: qrImageUrl,
      status: mapPaymentIntentStatus(attachedPaymentIntent?.data?.attributes?.status),
      expiresAt,
    });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
    res.status(statusCode).json({
      message: error?.message || 'Unable to create payment session.',
      hint: 'Check PAYMONGO_SECRET_KEY and the API logs. Restart with npm run api after updating .env.',
    });
  }
});

app.post('/api/orders/payment-review', async (req, res) => {
  try {
    const actorToken = String(req.body?.actorToken || '').trim();

    if (!actorToken) {
      return res.status(401).json({ message: 'You must be signed in to submit payment proof.' });
    }

    const { auth: adminAuth, db: adminDb, storage } = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(actorToken);

    const cart = Array.isArray(req.body?.cart) ? req.body.cart : [];
    const computedTotal = computeAmountFromCart(cart);
    const requestedTotal = Number(req.body?.total);
    const total = computedTotal > 0 ? computedTotal : requestedTotal;

    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ message: 'Order total must be a positive number.' });
    }

    if (cart.length === 0) {
      return res.status(400).json({ message: 'Cart is empty.' });
    }

    const now = new Date();
    const orderId = createOrderId();
    const shipping = req.body?.shipping && typeof req.body.shipping === 'object' ? req.body.shipping : {};
    const contact = req.body?.contact && typeof req.body.contact === 'object' ? req.body.contact : {};
    const payment = req.body?.payment && typeof req.body.payment === 'object' ? req.body.payment : {};

    const { proofImageUrl, proofStoragePath } = await uploadPaymentProof({
      storage,
      purchaserUid: decoded.uid,
      orderId,
      fileName: payment.proofFileName,
      proofImage: payment.proofImage,
    });

    const newOrder = {
      id: orderId,
      items: cart,
      total,
      status: 'Pending Payment Approval',
      date: now.toISOString(),
      estimatedDelivery: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      purchaserRole: 'customer',
      purchaserEmail: decoded.email || contact.email || '',
      purchaserUid: decoded.uid,
      shipping: {
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || decoded.email || '',
        addressLine: shipping.addressLine || '',
        city: shipping.city || '',
        stateProvince: shipping.stateProvince || '',
        postalCode: shipping.postalCode || '',
      },
      payment: {
        provider: 'paymongo',
        method: 'qrph',
        status: 'pending_review',
        reference: payment.reference || '',
        paymentIntentId: payment.paymentIntentId || '',
        qrImageUrl: payment.qrImageUrl || '',
        proofImage: proofImageUrl,
        proofStoragePath,
        proofFileName: payment.proofFileName || '',
        submittedAt: now.toISOString(),
      },
    };

    await adminDb.collection('orders').doc(orderId).set(newOrder);

    return res.status(200).json({
      ok: true,
      orderId,
      proofImageUrl,
    });
  } catch (error) {
    const statusCode = error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error' ? 401 : 500;
    return res.status(statusCode).json({
      message: error?.message || 'Unable to submit payment proof.',
    });
  }
});

app.get('/api/payments/status/:reference', async (req, res) => {
  const reference = req.params.reference;
  const paymentIntentIdFromQuery =
    typeof req.query?.paymentIntentId === 'string' && req.query.paymentIntentId.trim()
      ? req.query.paymentIntentId.trim()
      : '';
  const session = paymentSessions.get(reference);
  const paymentIntentId = session?.paymentIntentId || paymentIntentIdFromQuery;

  if (!paymentIntentId) {
    return res.status(404).json({ message: 'Payment session not found.' });
  }

  if (session && Date.now() >= session.expiresAt && session.status !== 'paid') {
    session.status = 'expired';
    paymentSessions.set(reference, session);
    return res.json({
      reference,
      paymentIntentId,
      status: 'expired',
      paymongoKeyMode,
      amount: session.amount,
      amountInCentavos: session.amountInCentavos,
      expiresAt: session.expiresAt,
    });
  }

  if (!paymongoSecretKey) {
    return res.json({
      reference,
      paymentIntentId,
      status: session?.status || 'waiting',
      paymongoKeyMode,
      amount: session?.amount || null,
      amountInCentavos: session?.amountInCentavos || null,
      expiresAt: session?.expiresAt || null,
    });
  }

  try {
    const paymentIntent = await retrievePaymentIntent(paymentIntentId);
    const paymentIntentStatus = paymentIntent?.data?.attributes?.status;
    const status = mapPaymentIntentStatus(paymentIntentStatus);
    const attributes = paymentIntent?.data?.attributes || {};

    if (session) {
      session.status = status;
      session.lastPaymentIntent = {
        status: paymentIntentStatus || null,
        lastPaymentError: attributes.last_payment_error || null,
        updatedAt: attributes.updated_at || null,
      };
      paymentSessions.set(reference, session);
    }

    res.json({
      reference,
      paymentIntentId,
      status,
      paymongoKeyMode,
      paymentIntentStatus,
      paymentIntentNextAction: attributes.next_action || null,
      paymentIntentLastPaymentError: attributes.last_payment_error || null,
      paymentIntentPayments: attributes.payments?.data || [],
      paymentIntentPaidAt: attributes.paid_at || null,
      paymentIntentUpdatedAt: attributes.updated_at || null,
      lastWebhookEvent: session?.lastWebhookEvent || null,
      amount: session?.amount || null,
      amountInCentavos: session?.amountInCentavos || null,
      expiresAt: session?.expiresAt || null,
    });
  } catch (error) {
    res.status(502).json({
      message: error?.message || 'Unable to verify payment status.',
      hint: 'Check the API logs and confirm that PAYMONGO_SECRET_KEY is valid.',
    });
  }
});

app.listen(port, () => {
  console.log(`PayMongo API listening on http://localhost:${port}`);
});
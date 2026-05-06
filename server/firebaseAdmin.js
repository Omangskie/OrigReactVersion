import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const parseAdminEmails = () =>
  (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || process.env.VITE_ADMIN_EMAIL || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const getCredentials = () => {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (json) {
    const parsed = JSON.parse(json);
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: String(parsed.private_key || '').replace(/\\n/g, '\n'),
    };
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };
};

const ensureApp = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const credentials = getCredentials();

  if (!credentials.projectId || !credentials.clientEmail || !credentials.privateKey) {
    throw new Error('Firebase Admin credentials are missing on the server.');
  }

  return initializeApp({
    credential: cert(credentials),
    projectId: credentials.projectId,
  });
};

export const getFirebaseAdmin = () => {
  const app = ensureApp();
  return {
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
};

export const allowedAdminEmails = parseAdminEmails();

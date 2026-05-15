import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const parseAdminEmails = () =>
  (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || process.env.VITE_ADMIN_EMAIL || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const getCredentials = () => {
  let parsed = null;
  let svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  // If no env var provided, try loading server/serviceAccount.json (development convenience)
  if (!svcJson) {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const localPath = path.join(__dirname, 'serviceAccount.json');
      if (fs.existsSync(localPath)) {
        svcJson = fs.readFileSync(localPath, 'utf8');
        console.log('Loaded Firebase service account from', localPath);
      }
    } catch (err) {
      // ignore and fall through to other env checks
    }
  }

  if (svcJson) {
    try {
      parsed = JSON.parse(svcJson);
    } catch (err) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON or server/serviceAccount.json: ' + err.message);
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: String(parsed.private_key || '').replace(/\\n/g, '\n'),
    };
  }

  // Fallback to individual env vars
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
    const help = `Firebase Admin credentials are missing on the server. Provide them by either:\n` +
      `1) Setting the environment variable FIREBASE_SERVICE_ACCOUNT_JSON to the service account JSON string, or\n` +
      `2) Placing the service account JSON at server/serviceAccount.json (development only), or\n` +
      `3) Setting FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY environment variables.`;
    console.error(help);
    throw new Error('Firebase Admin credentials are missing on the server. See server logs for instructions.');
  }

  // Determine storage bucket: prefer explicit env var, then try common defaults.
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || (credentials.projectId ? `${credentials.projectId}.firebasestorage.app` : undefined);

  const initConfig = {
    credential: cert(credentials),
    projectId: credentials.projectId,
  };

  if (storageBucket) {
    initConfig.storageBucket = storageBucket;
    console.log('Firebase Admin storage bucket set to', storageBucket);
  } else {
    console.warn('Firebase Admin storage bucket not configured explicitly; some Storage operations may fail.');
  }

  return initializeApp(initConfig);
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

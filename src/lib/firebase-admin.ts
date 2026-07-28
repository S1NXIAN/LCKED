/**
 * LCKED — Firebase Admin SDK (server-side only)
 * ---------------------------------------------------------------------------
 * Initializes the Firebase Admin SDK using the service account key stored in
 * the FIREBASE_SERVICE_ACCOUNT environment variable. This module is ONLY
 * imported by API routes (server-side) — never by client components.
 *
 * The Admin SDK has full CRUD on Firestore. All data stored in Firestore is
 * encrypted client-side before upload — the server NEVER sees plaintext.
 */

import admin from "firebase-admin";

let app: admin.app.App | null = null;

function getApp(): admin.app.App {
  if (app) return app;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });

  return app;
}

/** Get the Firestore instance (server-side only). */
export function getDb() {
  return admin.firestore();
}

/** Get the Auth instance (server-side only). */
export function getAuth() {
  return admin.auth();
}

/**
 * Verify a Firebase ID token and return the decoded token.
 * Throws if the token is invalid or expired.
 */
export async function verifyToken(idToken: string) {
  const auth = getAuth();
  return auth.verifyIdToken(idToken);
}

/**
 * Hash an email with SHA-256 for storage in Firestore.
 * We never store the raw email — only its hash.
 */
export async function hashEmail(email: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

export { getApp };
export default admin;

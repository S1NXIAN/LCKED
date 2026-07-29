/**
 * LCKED — Firebase Client SDK (browser only)
 * ---------------------------------------------------------------------------
 * Initializes the Firebase client SDK for Google Authentication.
 * The config is loaded from environment variables (NEXT_PUBLIC_*).
 *
 * This module is ONLY imported by client components — never by API routes.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getApp(): FirebaseApp {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getApp());
  return auth;
}

/**
 * Sign in with Google using a popup. Returns the ID token + email.
 */
export async function signInWithGoogle(): Promise<{ idToken: string; email: string }> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "consent" });
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  const email = result.user.email || "";
  return { idToken, email };
}

/**
 * Sign out the current Firebase user.
 */
export async function signOutFirebase() {
  const auth = getFirebaseAuth();
  await auth.signOut();
}

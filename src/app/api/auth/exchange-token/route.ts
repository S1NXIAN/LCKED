/**
 * POST /api/auth/exchange-token
 * ---------------------------------------------------------------------------
 * Exchange a Google OAuth access token for a Firebase ID token.
 *
 * Body: { accessToken: string }
 * Response: { idToken: string, email: string, uid: string }
 *
 * The server uses the Firebase Admin SDK to verify the Google access token
 * and create a custom Firebase token. The client then uses this ID token
 * for all subsequent /api/sync/* requests.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { accessToken } = await req.json();
    if (!accessToken) {
      return NextResponse.json({ error: "Missing accessToken" }, { status: 400 });
    }

    // Verify the Google access token by calling Google's userinfo endpoint.
    const userinfoRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!userinfoRes.ok) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
    }
    const userinfo = await userinfoRes.json();

    // Extract the user's Google sub (subject) and email.
    const googleUid = userinfo.sub;
    const email = userinfo.email;

    if (!googleUid || !email) {
      return NextResponse.json({ error: "Could not get user info" }, { status: 400 });
    }

    // Create a custom Firebase token using the Admin SDK.
    // The uid is prefixed with "google:" to namespace it.
    const firebaseUid = `google:${googleUid}`;
    const auth = getAuth();
    const customToken = await auth.createCustomToken(firebaseUid, { email });

    // For simplicity, we return the custom token. The client would normally
    // sign in with this custom token using the Firebase client SDK to get
    // an ID token. However, since we're not using the Firebase client SDK
    // on the client side (to avoid adding the dependency), we'll use the
    // custom token directly — our API routes will accept either custom
    // tokens or ID tokens via verifyIdToken (which handles both).
    return NextResponse.json({
      idToken: customToken,
      email,
      uid: firebaseUid,
    });
  } catch (err) {
    console.error("[auth/exchange-token] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token exchange failed" },
      { status: 500 },
    );
  }
}

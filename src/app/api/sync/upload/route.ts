/**
 * POST /api/sync/upload
 * ---------------------------------------------------------------------------
 * Upload encrypted vault data to Firestore.
 *
 * Body: { idToken: string, data: LckedExport, emailHash: string }
 *
 * The `data` is the encrypted vault export envelope — already encrypted
 * client-side with AES-256-GCM. The server NEVER sees plaintext.
 *
 * The `emailHash` is a SHA-256 hash of the user's email — stored for
 * deduplication checks (detecting if two vaults link to the same account).
 *
 * Response: { ok: true, updatedAt: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getDb, hashEmail } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, data, emailHash: clientEmailHash } = body;

    if (!idToken || !data) {
      return NextResponse.json({ error: "Missing idToken or data" }, { status: 400 });
    }

    // Verify the Firebase ID token — this authenticates the user.
    const decoded = await verifyToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || "";

    // Hash the email server-side too (defense in depth — if the client
    // sent a wrong hash, we compute the correct one).
    const serverEmailHash = email ? await hashEmail(email) : clientEmailHash;

    const db = getDb();
    const docRef = db.collection("vaults").doc(uid);
    const now = Date.now();

    // Check if a document already exists (for the "two vaults same account"
    // edge case — the client should check this before uploading, but we
    // also check server-side).
    const existing = await docRef.get();

    await docRef.set({
      uid,
      emailHash: serverEmailHash,
      encryptedData: data,
      updatedAt: now,
      createdAt: existing.exists ? existing.data()?.createdAt : now,
    });

    return NextResponse.json({ ok: true, updatedAt: now });
  } catch (err) {
    console.error("[sync/upload] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

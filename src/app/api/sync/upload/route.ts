/**
 * POST /api/sync/upload
 * ---------------------------------------------------------------------------
 * Upload encrypted vault data to Firestore. Uses `set()` (overwrite), NOT
 * `update()` (merge) — so connecting a new vault to an existing Google
 * account atomically replaces any stale encrypted data from a previous vault.
 *
 * Body: { idToken: string, data: LckedExport, emailHash: string }
 *
 * The `data` is the encrypted vault export envelope — already encrypted
 * client-side with AES-256-GCM. The server NEVER sees plaintext.
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

    const decoded = await verifyToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || "";
    const serverEmailHash = email ? await hashEmail(email) : clientEmailHash;

    const db = getDb();
    const docRef = db.collection("vaults").doc(uid);
    const now = Date.now();

    // Check if a document already exists (for preserving createdAt).
    const existing = await docRef.get();

    // `set()` overwrites the entire document — if the user reset a vault
    // on another device and is now uploading from a new vault, this
    // atomically replaces the stale encrypted data.
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

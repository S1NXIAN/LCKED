/**
 * GET /api/sync/download
 * ---------------------------------------------------------------------------
 * Download encrypted vault data from Firestore.
 *
 * Query: ?idToken=...
 *
 * Response: { ok: true, data: LckedExport | null, updatedAt: number | null }
 *
 * The `data` is the encrypted vault export envelope. The client decrypts
 * it locally with the master/export password. The server NEVER decrypts.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idToken = searchParams.get("idToken");

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const decoded = await verifyToken(idToken);
    const uid = decoded.uid;

    const db = getDb();
    const doc = await db.collection("vaults").doc(uid).get();

    if (!doc.exists) {
      return NextResponse.json({ ok: true, data: null, updatedAt: null });
    }

    const docData = doc.data()!;
    return NextResponse.json({
      ok: true,
      data: docData.encryptedData,
      updatedAt: docData.updatedAt,
      createdAt: docData.createdAt,
    });
  } catch (err) {
    console.error("[sync/download] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 },
    );
  }
}

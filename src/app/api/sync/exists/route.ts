/**
 * GET /api/sync/exists
 * ---------------------------------------------------------------------------
 * Check if encrypted vault data exists in Firestore for the given user.
 *
 * Query: ?idToken=...
 *
 * Response: { ok: true, exists: boolean, updatedAt: number | null }
 *
 * Used by:
 *   - The "connect" flow to detect if two vaults link to the same Google
 *     account (edge case: user creates a second vault and connects to an
 *     already-linked Google account).
 *   - The "download" flow to check if cloud data is newer than local data.
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
      return NextResponse.json({ ok: true, exists: false, updatedAt: null });
    }

    const docData = doc.data()!;
    return NextResponse.json({
      ok: true,
      exists: true,
      updatedAt: docData.updatedAt,
    });
  } catch (err) {
    console.error("[sync/exists] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/sync/delete
 * ---------------------------------------------------------------------------
 * Delete the user's encrypted vault data from Firestore.
 *
 * Body: { idToken: string }
 *
 * This is called when:
 *   - The user disconnects their Google account (with cloud data deletion).
 *   - The user resets their vault (forgot master password) — pending deletion
 *     is executed when the user comes back online.
 *
 * Response: { ok: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getDb } from "@/lib/firebase-admin";

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const decoded = await verifyToken(idToken);
    const uid = decoded.uid;

    const db = getDb();
    await db.collection("vaults").doc(uid).delete();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sync/delete] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 },
    );
  }
}

// Also support POST for convenience (some clients prefer POST over DELETE).
export async function POST(req: NextRequest) {
  return DELETE(req);
}

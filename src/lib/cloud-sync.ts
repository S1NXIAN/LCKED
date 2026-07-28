/**
 * LCKED — Cloud Sync (client-side)
 * ---------------------------------------------------------------------------
 * Handles all communication with the /api/sync/* API routes.
 *
 * The flow:
 *   1. User connects with Google OAuth → gets a Firebase ID token.
 *   2. Client checks if cloud data exists (/api/sync/exists).
 *   3. If cloud data exists and is newer → offer to download + decrypt.
 *   4. If no cloud data → upload current encrypted vault.
 *   5. On vault changes → auto-upload (debounced).
 *   6. On disconnect → delete cloud data + clear token.
 *
 * ALL data uploaded to the cloud is the encrypted vault export envelope
 * (AES-256-GCM). The server NEVER sees plaintext. The email is hashed
 * with SHA-256 before storage.
 *
 * Edge cases handled:
 *   - Forgot master password while offline: mark "pending cloud deletion"
 *     flag in localStorage. On next online + OAuth, execute the deletion.
 *   - Two vaults connected to same Google account: check exists() before
 *     uploading. If data exists, warn the user and require confirmation.
 *   - Disconnect while offline: require online connection. Show error toast.
 *   - OAuth verification before disconnect: require re-authentication with
 *     Google before disconnecting (second validation).
 */

import type { LckedExport } from "@/lib/import-export";

const PENDING_DELETION_KEY = "lcked-pending-cloud-deletion";
const OAUTH_TOKEN_KEY = "lcked-oauth-token";
const OAUTH_EMAIL_KEY = "lcked-oauth-email";

/* ─── Token management ────────────────────────────────────────────────── */

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(OAUTH_TOKEN_KEY);
}

export function setStoredToken(token: string, email: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(OAUTH_TOKEN_KEY, token);
  sessionStorage.setItem(OAUTH_EMAIL_KEY, email);
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(OAUTH_TOKEN_KEY);
  sessionStorage.removeItem(OAUTH_EMAIL_KEY);
}

export function getStoredEmail(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(OAUTH_EMAIL_KEY);
}

export function isOAuthConnected(): boolean {
  return !!getStoredToken();
}

/* ─── Pending deletion (offline edge case) ────────────────────────────── */

/**
 * When the user resets their vault while offline (forgot master password),
 * we can't delete the cloud data immediately. Mark a pending deletion flag.
 * On next online + OAuth connection, execute the deletion.
 */
export function markPendingCloudDeletion() {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_DELETION_KEY, "true");
}

export function clearPendingCloudDeletion() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_DELETION_KEY);
}

export function hasPendingCloudDeletion(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PENDING_DELETION_KEY) === "true";
}

/**
 * Execute any pending cloud deletion. Called on app init when online + OAuth.
 * Returns true if a deletion was executed, false otherwise.
 */
export async function executePendingDeletion(): Promise<boolean> {
  if (!hasPendingCloudDeletion()) return false;
  const token = getStoredToken();
  if (!token) return false; // Can't delete without a token — will retry later.

  try {
    await deleteCloudData(token);
    clearPendingCloudDeletion();
    return true;
  } catch {
    // Will retry on next init.
    return false;
  }
}

/* ─── API calls ───────────────────────────────────────────────────────── */

/** Check if cloud data exists for the current user. */
export async function checkCloudExists(idToken: string): Promise<{
  exists: boolean;
  updatedAt: number | null;
}> {
  const res = await fetch(`/api/sync/exists?idToken=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Failed to check cloud data");
  const json = await res.json();
  return { exists: json.exists, updatedAt: json.updatedAt };
}

/** Upload encrypted vault data to the cloud. */
export async function uploadCloudData(
  idToken: string,
  data: LckedExport,
  emailHash: string,
): Promise<{ updatedAt: number }> {
  const res = await fetch("/api/sync/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, data, emailHash }),
  });
  if (!res.ok) throw new Error("Failed to upload vault data");
  const json = await res.json();
  return { updatedAt: json.updatedAt };
}

/** Download encrypted vault data from the cloud. */
export async function downloadCloudData(
  idToken: string,
): Promise<{ data: LckedExport | null; updatedAt: number | null }> {
  const res = await fetch(`/api/sync/download?idToken=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Failed to download vault data");
  const json = await res.json();
  return { data: json.data, updatedAt: json.updatedAt };
}

/** Delete cloud data (used on disconnect + pending deletion). */
export async function deleteCloudData(idToken: string): Promise<void> {
  const res = await fetch("/api/sync/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Failed to delete cloud data");
}

/* ─── Email hashing (client-side, before sending to server) ───────────── */

export async function hashEmailClient(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ─── Online/offline detection ────────────────────────────────────────── */

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

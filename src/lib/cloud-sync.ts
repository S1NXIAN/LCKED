/**
 * LCKED — Smart Cloud Sync (automatic, lightweight)
 * ---------------------------------------------------------------------------
 * Replaces manual push/pull with automatic debounced sync.
 *
 * How it works:
 *   1. On vault unlock: pull from cloud. If cloud is newer → merge.
 *   2. On any vault mutation: debounce 3s → auto-upload.
 *   3. On going online (after offline): flush pending upload + check cloud.
 *   4. On going offline: mark offline; mutations are saved locally (IDB)
 *      and will sync when online.
 *   5. On lock: flush any pending upload immediately.
 *
 * Conflict resolution: last-write-wins based on `updatedAt` timestamp.
 * If cloud `updatedAt` > local latest `updatedAt` → pull (merge items by id,
 * cloud wins on conflict). If local is newer → push.
 *
 * All data is encrypted client-side (AES-256-GCM) before upload.
 * The server NEVER sees plaintext.
 */

import type { LckedExport } from "@/lib/import-export";

const OAUTH_TOKEN_KEY = "lcked-oauth-token";
const OAUTH_EMAIL_KEY = "lcked-oauth-email";
const OAUTH_EMAIL_HASH_KEY = "lcked-oauth-email-hash";
const PENDING_DELETION_KEY = "lcked-pending-cloud-deletion";
const LAST_SYNC_KEY = "lcked-cloud-last-sync";

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
  sessionStorage.removeItem(OAUTH_EMAIL_HASH_KEY);
}

export function getStoredEmail(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(OAUTH_EMAIL_KEY);
}

export function isOAuthConnected(): boolean {
  return !!getStoredToken();
}

/* ─── Email hashing ───────────────────────────────────────────────────── */

export async function hashEmailClient(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ─── Pending deletion (offline edge case) ────────────────────────────── */

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

/* ─── Online/offline detection ────────────────────────────────────────── */

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/* ─── Last sync timestamp ─────────────────────────────────────────────── */

export function getLastSync(): number | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(LAST_SYNC_KEY);
  return v ? parseInt(v, 10) : null;
}

export function setLastSync(ts: number) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LAST_SYNC_KEY, String(ts));
}

/* ─── API calls ───────────────────────────────────────────────────────── */

export async function checkCloudExists(idToken: string): Promise<{
  exists: boolean;
  updatedAt: number | null;
}> {
  const res = await fetch(`/api/sync/exists?idToken=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Failed to check cloud data");
  const json = await res.json();
  return { exists: json.exists, updatedAt: json.updatedAt };
}

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

export async function downloadCloudData(
  idToken: string,
): Promise<{ data: LckedExport | null; updatedAt: number | null }> {
  const res = await fetch(`/api/sync/download?idToken=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Failed to download vault data");
  const json = await res.json();
  return { data: json.data, updatedAt: json.updatedAt };
}

export async function deleteCloudData(idToken: string): Promise<void> {
  const res = await fetch("/api/sync/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Failed to delete cloud data");
}

/* ─── Pending cloud deletion execution ────────────────────────────────── */

export async function executePendingDeletion(): Promise<boolean> {
  if (!hasPendingCloudDeletion()) return false;
  const token = getStoredToken();
  if (!token) return false;
  try {
    await deleteCloudData(token);
    clearPendingCloudDeletion();
    return true;
  } catch {
    return false;
  }
}

/* ─── Smart sync engine ───────────────────────────────────────────────── */

/**
 * The smart sync engine. Created once on unlock; destroyed on lock.
 * Handles debounced auto-upload, auto-pull, and online/offline transitions.
 */
export class SmartSync {
  private uploadTimer: ReturnType<typeof setTimeout> | null = null;
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;
  private isSyncing = false;
  private lastLocalUpdate = 0;
  private uploadFn: () => Promise<void>;
  private pullFn: () => Promise<void>;

  constructor(uploadFn: () => Promise<void>, pullFn: () => Promise<void>) {
    this.uploadFn = uploadFn;
    this.pullFn = pullFn;
  }

  /** Start the sync engine. Listens to online/offline events. */
  start() {
    this.onlineListener = () => {
      // Going online: flush pending upload, then check for newer cloud data.
      this.flush().then(() => this.pull()).catch(() => {});
    };
    this.offlineListener = () => {
      // Going offline: cancel pending upload timer (will retry when online).
      if (this.uploadTimer) {
        clearTimeout(this.uploadTimer);
        this.uploadTimer = null;
      }
    };
    window.addEventListener("online", this.onlineListener);
    window.addEventListener("offline", this.offlineListener);
  }

  /** Stop the sync engine. Flush any pending upload. */
  async stop() {
    if (this.onlineListener) window.removeEventListener("online", this.onlineListener);
    if (this.offlineListener) window.removeEventListener("offline", this.offlineListener);
    if (this.uploadTimer) {
      clearTimeout(this.uploadTimer);
      this.uploadTimer = null;
    }
    // Flush pending upload before stopping (e.g., on lock).
    await this.flush();
  }

  /** Schedule a debounced upload (3s after the last mutation). */
  scheduleUpload() {
    this.lastLocalUpdate = Date.now();
    if (this.uploadTimer) clearTimeout(this.uploadTimer);
    this.uploadTimer = setTimeout(() => {
      this.uploadTimer = null;
      this.flush().catch(() => {});
    }, 3000);
  }

  /** Execute the upload immediately (cancel debounce timer). */
  async flush() {
    if (this.uploadTimer) {
      clearTimeout(this.uploadTimer);
      this.uploadTimer = null;
    }
    if (this.isSyncing) return;
    if (!isOnline()) return;
    if (!isOAuthConnected()) return;
    this.isSyncing = true;
    try {
      await this.uploadFn();
    } catch (err) {
      // Silent fail — will retry on next mutation or online event.
      console.warn("[smart-sync] Upload failed:", err);
    } finally {
      this.isSyncing = false;
    }
  }

  /** Pull from cloud (e.g., on unlock or on going online). */
  async pull() {
    if (this.isSyncing) return;
    if (!isOnline()) return;
    if (!isOAuthConnected()) return;
    this.isSyncing = true;
    try {
      await this.pullFn();
    } catch (err) {
      console.warn("[smart-sync] Pull failed:", err);
    } finally {
      this.isSyncing = false;
    }
  }
}

/* ─── Singleton instance ──────────────────────────────────────────────── */

let syncEngine: SmartSync | null = null;

export function getSyncEngine(): SmartSync | null {
  return syncEngine;
}

export function startSyncEngine(uploadFn: () => Promise<void>, pullFn: () => Promise<void>) {
  if (syncEngine) syncEngine.stop();
  syncEngine = new SmartSync(uploadFn, pullFn);
  syncEngine.start();
  return syncEngine;
}

export async function stopSyncEngine() {
  if (syncEngine) {
    await syncEngine.stop();
    syncEngine = null;
  }
}

export function notifyVaultMutation() {
  if (syncEngine) syncEngine.scheduleUpload();
}

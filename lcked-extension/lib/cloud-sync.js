/**
 * LCKED Extension — Cloud Sync
 * ---------------------------------------------------------------------------
 * Syncs encrypted vault data with the LCKED web app's Firebase Firestore
 * backend via the same /api/sync/* API routes.
 *
 * Flow:
 *   1. User clicks "Connect Google" in the popup.
 *   2. Extension uses chrome.identity.launchWebAuthFlow for Google OAuth.
 *   3. Access token is exchanged for a Firebase custom token via
 *      /api/auth/exchange-token.
 *   4. Encrypted vault data is uploaded/downloaded via /api/sync/*.
 *   5. Auto-sync is debounced (3s after last change) + on going online.
 */

const API_BASE = "http://localhost:3000"; // Change to production URL when deployed
const TOKEN_KEY = "lcked-oauth-token";
const EMAIL_KEY = "lcked-oauth-email";
const LAST_SYNC_KEY = "lcked-cloud-last-sync";

/* ─── Token management ────────────────────────────────────────────────── */

export async function getToken() {
  const result = await chrome.storage.session.get(TOKEN_KEY);
  return result[TOKEN_KEY] || null;
}

export async function setToken(token, email) {
  await chrome.storage.session.set({
    [TOKEN_KEY]: token,
    [EMAIL_KEY]: email,
  });
}

export async function clearToken() {
  await chrome.storage.session.remove([TOKEN_KEY, EMAIL_KEY, LAST_SYNC_KEY]);
}

export async function getEmail() {
  const result = await chrome.storage.session.get(EMAIL_KEY);
  return result[EMAIL_KEY] || null;
}

export async function isOAuthConnected() {
  return !!(await getToken());
}

/* ─── Google OAuth via chrome.identity ────────────────────────────────── */

const GOOGLE_CLIENT_ID = "965635642469-j3jh9fbb95bjpmv2811s6fd8r5sjhv57.apps.googleusercontent.com";
const REDIRECT_URI = chrome.identity.getRedirectURL();
const SCOPES = "email profile";

export async function connectGoogle() {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("prompt", "consent");

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!responseUrl) throw new Error("OAuth cancelled");

  // Extract access_token from the redirect URL hash fragment.
  const hashStr = responseUrl.includes("#") ? responseUrl.split("#")[1] : "";
  const params = new URLSearchParams(hashStr);
  const accessToken = params.get("access_token");
  if (!accessToken) throw new Error("No access token in OAuth response");

  // Exchange the access token for a Firebase custom token.
  const exchangeRes = await fetch(`${API_BASE}/api/auth/exchange-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!exchangeRes.ok) throw new Error("Token exchange failed");
  const { idToken, email } = await exchangeRes.json();

  await setToken(idToken, email);

  // Check if cloud data exists.
  const existsRes = await fetch(`${API_BASE}/api/sync/exists?idToken=${encodeURIComponent(idToken)}`);
  const existsData = await existsRes.json();

  return { idToken, email, exists: existsData.exists, updatedAt: existsData.updatedAt };
}

/* ─── API calls ───────────────────────────────────────────────────────── */

export async function uploadCloudData(data) {
  const token = await getToken();
  if (!token) throw new Error("Not connected");
  const email = await getEmail();
  const emailHash = await hashEmail(email || "");
  const res = await fetch(`${API_BASE}/api/sync/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token, data, emailHash }),
  });
  if (!res.ok) throw new Error("Upload failed");
  const json = await res.json();
  await chrome.storage.session.set({ [LAST_SYNC_KEY]: json.updatedAt });
  return json.updatedAt;
}

export async function downloadCloudData() {
  const token = await getToken();
  if (!token) throw new Error("Not connected");
  const res = await fetch(`${API_BASE}/api/sync/download?idToken=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error("Download failed");
  return res.json();
}

export async function deleteCloudData() {
  const token = await getToken();
  if (!token) throw new Error("Not connected");
  const res = await fetch(`${API_BASE}/api/sync/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!res.ok) throw new Error("Delete failed");
}

export async function disconnect(deleteCloud) {
  if (deleteCloud) {
    try { await deleteCloudData(); } catch { /* best-effort */ }
  }
  await clearToken();
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

async function hashEmail(email) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getLastSync() {
  const result = await chrome.storage.session.get(LAST_SYNC_KEY);
  return result[LAST_SYNC_KEY] || null;
}

/* ─── Smart sync (debounced auto-upload) ──────────────────────────────── */

let uploadTimer = null;
let isSyncing = false;

export function scheduleUpload(uploadFn) {
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    uploadTimer = null;
    if (isSyncing) return;
    if (!(await isOAuthConnected())) return;
    if (!navigator.onLine) return;
    isSyncing = true;
    try {
      await uploadFn();
    } catch (err) {
      console.warn("[ext-sync] Upload failed:", err);
    } finally {
      isSyncing = false;
    }
  }, 3000);
}

export async function flushUpload(uploadFn) {
  if (uploadTimer) {
    clearTimeout(uploadTimer);
    uploadTimer = null;
  }
  if (isSyncing) return;
  if (!(await isOAuthConnected())) return;
  if (!navigator.onLine) return;
  isSyncing = true;
  try {
    await uploadFn();
  } catch (err) {
    console.warn("[ext-sync] Flush failed:", err);
  } finally {
    isSyncing = false;
  }
}

export function getIsSyncing() {
  return isSyncing;
}

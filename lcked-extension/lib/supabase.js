// lib/supabase.js
// Minimal Supabase REST client for the LCKED extension.
// Uses the PostgREST API directly (no SDK) so the bundle stays tiny and
// works inside an MV3 service worker.
//
// Required chrome.storage.local keys (set via the popup Settings tab once
// the user logs in / configures the extension):
//   lcked_supabase_url   e.g. https://abcdefgh.supabase.co
//   lcked_supabase_anon  anon/public key (sent as apikey header)
//   lcked_supabase_token user JWT (sent as Authorization: Bearer)
//   lcked_supabase_uid   authenticated user id (row-level security filter)
//
// All vault entries are stored encrypted (AES-256-GCM) in the `vault_entries`
// table; this module never sees plaintext.

const ENTRIES_TABLE = "vault_entries";

/** Read config from chrome.storage.local as a single object. */
function getConfig() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      [
        "lcked_supabase_url",
        "lcked_supabase_anon",
        "lcked_supabase_token",
        "lcked_supabase_uid",
      ],
      (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(items || {});
      }
    );
  });
}

/** Persist config to chrome.storage.local. */
export function setConfig(patch) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(patch, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(true);
    });
  });
}

/** Clear all Supabase config (logout). */
export function clearConfig() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(
      [
        "lcked_supabase_url",
        "lcked_supabase_anon",
        "lcked_supabase_token",
        "lcked_supabase_uid",
      ],
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(true);
      }
    );
  });
}

/** Returns true if all 4 required config keys are present. */
export async function isConfigured() {
  const c = await getConfig();
  return Boolean(
    c.lcked_supabase_url &&
      c.lcked_supabase_anon &&
      c.lcked_supabase_token &&
      c.lcked_supabase_uid
  );
}

/** Return the JWT bearer token (or null when not logged in). */
export async function getAuthToken() {
  const c = await getConfig();
  return c.lcked_supabase_token || null;
}

/** Return the authenticated user id (or null). */
export async function getUserId() {
  const c = await getConfig();
  return c.lcked_supabase_uid || null;
}

/** Return the base Supabase URL (no trailing slash). */
export async function getBaseUrl() {
  const c = await getConfig();
  return (c.lcked_supabase_url || "").replace(/\/+$/, "");
}

/**
 * Internal: POST a JSON body to Supabase Auth (`/auth/v1/...`).
 * Used for email/password login to obtain a JWT.
 */
async function authFetch(path, { method = "POST", body, query } = {}) {
  const c = await getConfig();
  if (!c.lcked_supabase_url || !c.lcked_supabase_anon) {
    throw new Error("Supabase URL and anon key are required");
  }
  const url = new URL(
    `${c.lcked_supabase_url.replace(/\/+$/, "")}/auth/v1/${path.replace(/^\/+/, "")}`
  );
  if (query) {
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      apikey: c.lcked_supabase_anon,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leave json null */
  }
  if (!res.ok) {
    const msg =
      (json && (json.message || json.error_description || json.error)) ||
      `Supabase auth ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Login with email + password. Persists the JWT + user id to
 * chrome.storage.local on success. Returns `{ access_token, user }`.
 */
export async function loginWithEmail(email, password) {
  const json = await authFetch("token", {
    method: "POST",
    query: { grant_type: "password" },
    body: { email, password },
  });
  const token = json && json.access_token;
  const uid = json && json.user && json.user.id;
  if (!token || !uid) {
    throw new Error("Supabase did not return a valid token");
  }
  await setConfig({
    lcked_supabase_token: token,
    lcked_supabase_uid: uid,
  });
  return { access_token: token, user: json.user };
}

/**
 * Internal: call the PostgREST `/rest/v1/<table>` endpoint.
 * Adds both `apikey` and `Authorization: Bearer` headers (PostgREST requires
 * both when RLS is on).
 */
async function restFetch(path, { method = "GET", body, query } = {}) {
  const c = await getConfig();
  if (!c.lcked_supabase_url || !c.lcked_supabase_anon || !c.lcked_supabase_token) {
    throw new Error("Supabase is not configured. Open the extension settings.");
  }
  const url = new URL(
    `${c.lcked_supabase_url.replace(/\/+$/, "")}/rest/v1/${path.replace(/^\/+/, "")}`
  );
  if (query) {
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const headers = {
    apikey: c.lcked_supabase_anon,
    Authorization: `Bearer ${c.lcked_supabase_token}`,
    "Content-Type": "application/json",
    Prefer: body ? "return=representation" : undefined,
  };
  if (!body) delete headers.Prefer;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leave json null */
  }
  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      `Supabase REST ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Fetch every vault entry for the configured user.
 * PostgREST filters via `?user_id=eq.<uid>`.
 * Returns `[{ id, user_id, cipher, iv, domain, username, updated_at, ... }]`.
 */
export async function fetchEntries() {
  const uid = await getUserId();
  if (!uid) return [];
  const rows = await restFetch(ENTRIES_TABLE, {
    method: "GET",
    query: {
      "user_id": `eq.${uid}`,
      "order": "updated_at.desc",
      "select": "*",
    },
  });
  return Array.isArray(rows) ? rows : [];
}

/**
 * Upsert a single vault entry. If `entry.id` is set we PATCH; otherwise we
 * POST a new row. Returns the persisted row.
 *
 * @param {object} entry  { id?, user_id, cipher, iv, domain, username, name, updated_at }
 */
export async function upsertEntry(entry) {
  const uid = await getUserId();
  if (!uid) throw new Error("No user id — log in first.");
  const payload = { ...entry, user_id: entry.user_id || uid };

  if (entry.id) {
    const rows = await restFetch(ENTRIES_TABLE, {
      method: "PATCH",
      query: { id: `eq.${entry.id}`, "user_id": `eq.${uid}` },
      body: payload,
    });
    return Array.isArray(rows) && rows.length ? rows[0] : payload;
  }
  const rows = await restFetch(ENTRIES_TABLE, {
    method: "POST",
    body: payload,
  });
  return Array.isArray(rows) && rows.length ? rows[0] : payload;
}

/**
 * Delete a single vault entry by id. No-op if id is empty.
 */
export async function deleteEntry(id) {
  if (!id) throw new Error("deleteEntry: id is required");
  const uid = await getUserId();
  await restFetch(ENTRIES_TABLE, {
    method: "DELETE",
    query: { id: `eq.${id}`, "user_id": `eq.${uid}` },
  });
  return true;
}

export const __internal = { getConfig, setConfig, ENTRIES_TABLE };

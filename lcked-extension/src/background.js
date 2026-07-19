// src/background.js
// LCKED service worker (MV3, ES module).
//
// Responsibilities:
//   * Maintain context-menu items.
//   * Route messages from the popup and content scripts.
//   * Keep an in-memory cache of decrypted vault items (cleared on lock).
//   * Detect "update vs save_new" when the user submits a login form.
//   * Coordinate autofill into the active tab via the content script.

import {
  isConfigured,
  fetchEntries,
  upsertEntry,
  deleteEntry,
  getUserId,
  loginWithEmail,
  setConfig,
  clearConfig,
} from "../lib/supabase.js";

import {
  deriveMasterKey,
  getOrCreateSalt,
  buildVerifier,
  verifyMasterKey,
  storeSessionKey,
  getSessionKey,
  clearSessionKey,
  hasSessionKey,
  encryptJson,
  decryptJson,
  clearVaultCrypto,
} from "../lib/crypto.js";

// ---- in-memory decrypted cache ----------------------------------------

/** @type {Array<object>|null} null until first successful UNLOCK. */
let decryptedCache = null;
let lastSyncedAt = null;

// ---- helpers -----------------------------------------------------------

function log(...args) {
  try {
    console.log("[LCKED bg]", ...args);
  } catch {
    /* SW may have no console in some contexts */
  }
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Domain matching with subdomain support.
 *
 *   storedDomain  = "example.com"
 *   currentDomain = "login.example.com"  → match (subdomain of stored)
 *   currentDomain = "example.com"        → match (exact)
 *   currentDomain = "evilexample.com"    → no match (suffix but not a subdomain)
 *
 * Symmetric: also accepts the reverse case (stored is a subdomain of current).
 */
export function domainMatches(storedDomain, currentDomain) {
  if (!storedDomain || !currentDomain) return false;
  const a = storedDomain.toLowerCase().replace(/^www\./, "");
  const b = currentDomain.toLowerCase().replace(/^www\./, "");
  if (a === b) return true;
  // b is a subdomain of a?
  if (b.endsWith("." + a)) return true;
  // a is a subdomain of b?
  if (a.endsWith("." + b)) return true;
  return false;
}

/** Pull the plain fields out of a decrypted item for matching / display. */
function itemSummary(item) {
  return {
    id: item.id,
    name: item.name || "",
    username: item.username || "",
    password: item.password || "",
    domain: item.domain || "",
    urls: Array.isArray(item.urls) ? item.urls : [],
    updatedAt: item.updatedAt || item.updated_at || null,
  };
}

// ---- context menu ------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "lcked-autofill",
      title: "LCKED: Auto-fill login",
      contexts: ["editable", "page"],
    });
    chrome.contextMenus.create({
      id: "lcked-save",
      title: "LCKED: Save/update this login",
      contexts: ["editable", "page"],
    });
  });
  log("installed");
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === "lcked-autofill") {
    const domain = hostnameOf(tab.url);
    const matches = await itemsForDomain(domain);
    if (matches.length === 0) {
      chrome.tabs.sendMessage(tab.id, {
        type: "NOTIFY",
        level: "info",
        message: "No LCKED credentials saved for this site.",
      });
      return;
    }
    // Use the most recently updated match.
    const chosen = matches.reduce((a, b) =>
      (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a
    );
    chrome.tabs.sendMessage(tab.id, { type: "AUTOFILL", credentials: chosen });
  } else if (info.menuItemId === "lcked-save") {
    chrome.tabs.sendMessage(tab.id, { type: "DETECT_SAVE" });
  }
});

// ---- keyboard commands -------------------------------------------------

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd === "autofill-active-tab") {
    const tab = await getActiveTab();
    if (!tab) return;
    const domain = hostnameOf(tab.url || "");
    const matches = await itemsForDomain(domain);
    if (matches.length === 0) {
      chrome.tabs.sendMessage(tab.id, {
        type: "NOTIFY",
        level: "info",
        message: "No LCKED credentials for this site.",
      });
      return;
    }
    const chosen = matches.reduce((a, b) =>
      (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a
    );
    chrome.tabs.sendMessage(tab.id, { type: "AUTOFILL", credentials: chosen });
  }
});

// ---- vault cache loaders ----------------------------------------------

async function loadAndDecryptAll() {
  const key = await getSessionKey();
  if (!key) {
    decryptedCache = null;
    return null;
  }
  const rows = await fetchEntries();
  const items = [];
  for (const row of rows) {
    try {
      const plain = await decryptJson(row.cipher, row.iv, key);
      items.push({
        ...plain,
        id: row.id,
        domain: plain.domain || row.domain || "",
        name: plain.name || row.name || "",
        username: plain.username || row.username || "",
        password: plain.password || "",
        urls: Array.isArray(plain.urls) ? plain.urls : [],
        updatedAt: row.updated_at || plain.updatedAt || null,
      });
    } catch (err) {
      log("decrypt failed for row", row.id, err);
    }
  }
  decryptedCache = items;
  lastSyncedAt = Date.now();
  return items;
}

async function itemsForDomain(domain) {
  if (!decryptedCache) await loadAndDecryptAll();
  if (!decryptedCache) return [];
  return decryptedCache
    .filter((it) => domainMatches(it.domain, domain))
    .map(itemSummary);
}

/**
 * Decide whether a captured credential is an update or a new entry.
 *   same domain + same username + different password → "update" (with itemId)
 *   same domain + new username                       → "save_new"
 *   no match at all                                  → "save_new"
 */
async function checkUpdate({ domain, username, password }) {
  if (!decryptedCache) await loadAndDecryptAll();
  if (!decryptedCache) return { action: "save_new" };
  const candidates = decryptedCache.filter((it) =>
    domainMatches(it.domain, domain)
  );
  const sameUser = candidates.find(
    (it) => (it.username || "") === (username || "")
  );
  if (sameUser) {
    if ((sameUser.password || "") === (password || "")) {
      return { action: "noop", itemId: sameUser.id };
    }
    return { action: "update", itemId: sameUser.id };
  }
  return { action: "save_new" };
}

// ---- message router ----------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Always return true so the response can be async.
  (async () => {
    try {
      switch (msg && msg.type) {
        case "GET_VAULT_STATUS": {
          const configured = await isConfigured();
          const unlocked = await hasSessionKey();
          sendResponse({
            ok: true,
            configured,
            unlocked,
            itemCount: decryptedCache ? decryptedCache.length : 0,
            lastSyncedAt,
          });
          return;
        }

        case "UNLOCK": {
          const configured = await isConfigured();
          if (!configured) {
            sendResponse({ ok: false, error: "Not configured" });
            return;
          }
          const password = msg.masterPassword;
          if (!password) {
            sendResponse({ ok: false, error: "Master password required" });
            return;
          }
          const salt = await getOrCreateSalt();
          const key = await deriveMasterKey(password, salt);
          const ok = await verifyMasterKey(key);
          if (!ok) {
            sendResponse({ ok: false, error: "Wrong master password" });
            return;
          }
          await storeSessionKey(key);
          // Make sure a verifier exists (first run).
          try {
            await buildVerifier(key);
          } catch {
            /* ignore */
          }
          await loadAndDecryptAll();
          sendResponse({
            ok: true,
            itemCount: decryptedCache ? decryptedCache.length : 0,
            lastSyncedAt,
          });
          return;
        }

        case "LOCK": {
          await clearSessionKey();
          decryptedCache = null;
          lastSyncedAt = null;
          sendResponse({ ok: true });
          return;
        }

        case "GET_ITEMS_FOR_DOMAIN": {
          const items = await itemsForDomain(msg.domain || "");
          sendResponse({ ok: true, items });
          return;
        }

        case "GET_ALL_ITEMS": {
          if (!decryptedCache) await loadAndDecryptAll();
          const items = (decryptedCache || []).map(itemSummary);
          sendResponse({ ok: true, items });
          return;
        }

        case "AUTOFILL_REQUEST": {
          if (!decryptedCache) await loadAndDecryptAll();
          const item = (decryptedCache || []).find((it) => it.id === msg.itemId);
          if (!item) {
            sendResponse({ ok: false, error: "Item not found" });
            return;
          }
          const tab = await getActiveTab();
          if (!tab) {
            sendResponse({ ok: false, error: "No active tab" });
            return;
          }
          chrome.tabs.sendMessage(tab.id, {
            type: "AUTOFILL",
            credentials: itemSummary(item),
          });
          sendResponse({ ok: true });
          return;
        }

        case "CHECK_UPDATE": {
          const result = await checkUpdate({
            domain: msg.domain,
            username: msg.username,
            password: msg.password,
          });
          sendResponse({ ok: true, ...result });
          return;
        }

        case "SAVE_CREDENTIAL": {
          const key = await getSessionKey();
          if (!key) {
            sendResponse({ ok: false, error: "Vault is locked" });
            return;
          }
          const payload = {
            name: msg.name || msg.domain || "",
            domain: msg.domain || "",
            username: msg.username || "",
            password: msg.password || "",
            urls: Array.isArray(msg.urls) ? msg.urls : msg.domain ? [msg.domain] : [],
            notes: msg.notes || "",
            updatedAt: new Date().toISOString(),
          };
          const { cipher, iv } = await encryptJson(payload, key);
          const row = await upsertEntry({
            id: msg.id || undefined,
            cipher,
            iv,
            domain: payload.domain,
            username: payload.username,
            name: payload.name,
            updated_at: payload.updatedAt,
          });
          // Refresh cache.
          await loadAndDecryptAll();
          sendResponse({ ok: true, id: row && row.id });
          return;
        }

        case "DELETE_CREDENTIAL": {
          if (msg.id) await deleteEntry(msg.id);
          await loadAndDecryptAll();
          sendResponse({ ok: true });
          return;
        }

        case "REFRESH": {
          await loadAndDecryptAll();
          sendResponse({
            ok: true,
            itemCount: decryptedCache ? decryptedCache.length : 0,
            lastSyncedAt,
          });
          return;
        }

        case "LOGIN_EMAIL": {
          try {
            const r = await loginWithEmail(msg.email, msg.password);
            sendResponse({ ok: true, uid: r.user && r.user.id });
          } catch (e) {
            sendResponse({ ok: false, error: e.message });
          }
          return;
        }

        case "CONFIGURE_SUPABASE": {
          await setConfig({
            lcked_supabase_url: msg.url,
            lcked_supabase_anon: msg.anonKey,
          });
          sendResponse({ ok: true });
          return;
        }

        case "LOGOUT_SUPABASE": {
          await clearConfig();
          await clearSessionKey();
          decryptedCache = null;
          lastSyncedAt = null;
          sendResponse({ ok: true });
          return;
        }

        case "RESET_VAULT": {
          await clearVaultCrypto();
          decryptedCache = null;
          lastSyncedAt = null;
          sendResponse({ ok: true });
          return;
        }

        case "PING": {
          sendResponse({ ok: true, pong: Date.now() });
          return;
        }

        default:
          sendResponse({ ok: false, error: `Unknown message: ${msg && msg.type}` });
      }
    } catch (err) {
      log("message handler error", msg && msg.type, err);
      sendResponse({ ok: false, error: (err && err.message) || String(err) });
    }
  })();
  return true; // async response
});

// ---- session lifecycle -------------------------------------------------

// Auto-lock when the browser session ends is implicit (chrome.storage.session
// is cleared on browser close). We also lock when the SW is about to be
// suspended is not necessary — the cache dies with the SW and the session
// key persists in chrome.storage.session for the next SW instantiation.
//
// Listen for storage.session changes from another context (e.g., popup Lock
// button calling clearSessionKey directly) and mirror to the in-memory cache.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.lcked_session_key) {
    if (!changes.lcked_session_key.newValue) {
      decryptedCache = null;
      lastSyncedAt = null;
      log("vault locked via session storage change");
    }
  }
});

log("service worker loaded");

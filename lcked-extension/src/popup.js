// src/popup.js
// LCKED popup — 360px wide, Mocha themed.
//
// States:
//   setup    → not configured (no Supabase URL/anon + no JWT)
//   unlock   → configured but vault locked (no session key)
//   vault    → unlocked (search + this site + all items)
//   settings → overlay (account info, refresh, reset, sign out)

(() => {
  "use strict";

  // ---- icons (inline SVG strings) -------------------------------------
  const ICON = {
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
    key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4"/><path d="m18 5 2 2"/><path d="m15 8 2 2"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    fill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
    empty: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  };

  // ---- helpers --------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function bg(type, payload = {}) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, ...payload }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp);
          }
        });
      } catch (e) {
        resolve({ ok: false, error: String(e) });
      }
    });
  }

  function showState(name) {
    $$(".lcked-state").forEach((s) => s.classList.remove("active"));
    const el = $(`#state-${name}`);
    if (el) el.classList.add("active");
    // Toggle header buttons.
    $("#lockBtn").classList.toggle("hidden", name !== "vault");
    $("#settingsBtn").classList.toggle("hidden", name === "setup");
    // Footer status text.
    const status = $("#footer-status");
    if (status) {
      status.textContent =
        name === "setup"
          ? "Not connected"
          : name === "unlock"
          ? "Locked"
          : name === "vault"
          ? "Unlocked"
          : "Settings";
    }
  }

  function showError(id, msg) {
    const el = $(`#${id}`);
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("show", Boolean(msg));
  }

  function setFooterStatus(text) {
    const el = $("#footer-status");
    if (el) el.textContent = text;
  }

  // ---- copy with auto-clear ------------------------------------------
  let clearTimer = null;
  async function copyWithFeedback(btn, value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback: hidden textarea + execCommand (some pages disable clipboard API).
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    const orig = btn.innerHTML;
    btn.innerHTML = ICON.check;
    btn.classList.add("copied");
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      navigator.clipboard.writeText("").catch(() => {});
      btn.innerHTML = orig;
      btn.classList.remove("copied");
      clearTimer = null;
    }, 20000);
  }

  // ---- item rendering -------------------------------------------------
  function faviconLetter(name) {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  }

  function renderEmpty(listEl, message) {
    listEl.innerHTML = `<div class="lcked-empty">${ICON.empty}<div>${message}</div></div>`;
  }

  function renderItem(item, opts = {}) {
    const wrap = document.createElement("div");
    wrap.className = "lcked-item";
    const letter = faviconLetter(item.name || item.domain);
    wrap.innerHTML = `
      <div class="favicon">${escapeHtml(letter)}</div>
      <div class="meta" role="button" tabindex="0">
        <span class="name">${escapeHtml(item.name || item.domain || "Untitled")}</span>
        <span class="sub">${escapeHtml(item.username || item.domain || "")}</span>
      </div>
      <div class="actions">
        ${
          item.username
            ? `<button class="copy-user" title="Copy username">${ICON.user}</button>`
            : ""
        }
        ${
          item.password
            ? `<button class="copy-pass" title="Copy password">${ICON.key}</button>`
            : ""
        }
        <button class="fill" title="Auto-fill current tab">${ICON.fill}</button>
      </div>
    `;
    const meta = wrap.querySelector(".meta");
    const onActivate = () => {
      if (opts.onFill) opts.onFill(item);
    };
    meta.addEventListener("click", onActivate);
    meta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    });
    const fillBtn = wrap.querySelector(".fill");
    if (fillBtn) fillBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onActivate();
    });
    const cu = wrap.querySelector(".copy-user");
    if (cu) cu.addEventListener("click", (e) => {
      e.stopPropagation();
      copyWithFeedback(cu, item.username);
    });
    const cp = wrap.querySelector(".copy-pass");
    if (cp) cp.addEventListener("click", (e) => {
      e.stopPropagation();
      copyWithFeedback(cp, item.password);
    });
    return wrap;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---- vault state ----------------------------------------------------
  let allItems = [];
  let activeDomain = "";

  async function getActiveTabDomain() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.url) return resolve("");
        try {
          const u = new URL(tab.url);
          if (u.protocol !== "http:" && u.protocol !== "https:") return resolve("");
          resolve(u.hostname);
        } catch {
          resolve("");
        }
      });
    });
  }

  function matchesQuery(item, q) {
    if (!q) return true;
    q = q.toLowerCase();
    const hay = `${item.name || ""} ${item.username || ""} ${item.domain || ""}`.toLowerCase();
    return hay.includes(q);
  }

  function domainMatches(stored, current) {
    if (!stored || !current) return false;
    const a = stored.toLowerCase().replace(/^www\./, "");
    const b = current.toLowerCase().replace(/^www\./, "");
    if (a === b) return true;
    if (b.endsWith("." + a)) return true;
    if (a.endsWith("." + b)) return true;
    return false;
  }

  function renderVault(query = "") {
    const thisSiteList = $("#this-site-list");
    const allList = $("#all-items-list");
    const thisSiteSection = $("#section-this-site");

    // This site
    const siteItems = allItems.filter((it) =>
      domainMatches(it.domain, activeDomain)
    );
    if (activeDomain && siteItems.length > 0) {
      thisSiteSection.classList.remove("hidden");
      $("#this-site-count").textContent = String(siteItems.length);
      thisSiteList.innerHTML = "";
      siteItems
        .filter((it) => matchesQuery(it, query))
        .forEach((it) =>
          thisSiteList.appendChild(
            renderItem(it, { onFill: () => autofill(it) })
          )
        );
      if (thisSiteList.children.length === 0) {
        renderEmpty(thisSiteList, "No matches for this site.");
      }
    } else {
      thisSiteSection.classList.add("hidden");
    }

    // All items
    const filtered = allItems.filter((it) => matchesQuery(it, query));
    $("#all-items-count").textContent = String(filtered.length);
    allList.innerHTML = "";
    if (filtered.length === 0) {
      renderEmpty(allList, query ? "No matching items." : "Your vault is empty.");
      return;
    }
    filtered.forEach((it) =>
      allList.appendChild(renderItem(it, { onFill: () => autofill(it) }))
    );
  }

  async function autofill(item) {
    setFooterStatus("Filling…");
    const resp = await bg("AUTOFILL_REQUEST", { itemId: item.id });
    if (resp && resp.ok) {
      setFooterStatus("Filled");
      window.close();
    } else {
      setFooterStatus("Failed");
      showError("unlockError", resp && resp.error ? resp.error : "Auto-fill failed.");
    }
  }

  async function loadVault() {
    setFooterStatus("Loading…");
    activeDomain = await getActiveTabDomain();
    const resp = await bg("GET_ALL_ITEMS");
    if (!resp || !resp.ok) {
      setFooterStatus("Error");
      renderEmpty($("#all-items-list"), "Could not load vault.");
      return;
    }
    allItems = resp.items || [];
    // sort: most recently updated first
    allItems.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    $("#brandSub").textContent = activeDomain
      ? activeDomain.replace(/^www\./, "")
      : "Local Vault";
    renderVault($("#search").value || "");
    setFooterStatus(`${allItems.length} items`);
  }

  // ---- setup flow -----------------------------------------------------
  async function handleSetup() {
    showError("setupError", "");
    const url = $("#su-url").value.trim();
    const anon = $("#su-anon").value.trim();
    const email = $("#su-email").value.trim();
    const password = $("#su-pass").value;
    const master = $("#su-master").value;

    if (!url || !anon || !email || !password || !master) {
      showError("setupError", "Please fill in every field.");
      return;
    }
    if (master.length < 8) {
      showError("setupError", "Master password must be at least 8 characters.");
      return;
    }

    const btn = $("#setupBtn");
    btn.disabled = true;
    setFooterStatus("Connecting…");

    // 1. Persist Supabase URL + anon key.
    const cfg = await bg("CONFIGURE_SUPABASE", { url, anonKey: anon });
    if (!cfg || !cfg.ok) {
      btn.disabled = false;
      setFooterStatus("Error");
      showError("setupError", (cfg && cfg.error) || "Could not save config.");
      return;
    }

    // 2. Login (obtain JWT + user id).
    const login = await bg("LOGIN_EMAIL", { email, password });
    if (!login || !login.ok) {
      btn.disabled = false;
      setFooterStatus("Error");
      showError(
        "setupError",
        (login && login.error) || "Login failed. Check your email and password."
      );
      return;
    }

    // 3. Derive master key + unlock.
    const unlock = await bg("UNLOCK", { masterPassword: master });
    btn.disabled = false;
    if (!unlock || !unlock.ok) {
      setFooterStatus("Error");
      showError(
        "setupError",
        (unlock && unlock.error) || "Could not derive master key."
      );
      return;
    }

    setFooterStatus("Unlocked");
    showState("vault");
    await loadVault();
  }

  // ---- unlock flow ----------------------------------------------------
  async function handleUnlock() {
    showError("unlockError", "");
    const master = $("#unlock-pass").value;
    if (!master) {
      showError("unlockError", "Enter your master password.");
      return;
    }
    const btn = $("#unlockBtn");
    btn.disabled = true;
    setFooterStatus("Unlocking…");
    const resp = await bg("UNLOCK", { masterPassword: master });
    btn.disabled = false;
    if (!resp || !resp.ok) {
      setFooterStatus("Locked");
      showError(
        "unlockError",
        (resp && resp.error) || "Wrong master password."
      );
      return;
    }
    $("#unlock-pass").value = "";
    setFooterStatus("Unlocked");
    showState("vault");
    await loadVault();
  }

  // ---- settings flow --------------------------------------------------
  async function openSettings() {
    $("#state-vault").classList.remove("active");
    $("#state-settings").classList.add("active");
    $("#lockBtn").classList.add("hidden");
    const status = await bg("GET_VAULT_STATUS");
    $("#settings-status").textContent =
      status && status.configured ? "Connected" : "Not configured";
    $("#settings-uid").textContent =
      status && status.unlocked ? "•••• (active session)" : "(vault locked)";
    $("#settings-count").textContent = String((status && status.itemCount) || 0);
    setFooterStatus("Settings");
  }

  function closeSettings() {
    $("#state-settings").classList.remove("active");
    $("#state-vault").classList.add("active");
    $("#lockBtn").classList.remove("hidden");
    setFooterStatus(`${allItems.length} items`);
  }

  async function handleRefresh() {
    setFooterStatus("Refreshing…");
    const resp = await bg("REFRESH");
    if (resp && resp.ok) {
      await loadVault();
    } else {
      setFooterStatus("Error");
    }
  }

  async function handleReset() {
    if (
      !confirm(
        "Reset the local vault on this device?\n\nThis clears the master key, salt, and verifier. Encrypted entries on the server are NOT deleted."
      )
    )
      return;
    setFooterStatus("Resetting…");
    await bg("RESET_VAULT");
    allItems = [];
    activeDomain = "";
    setFooterStatus("Reset");
    showState("setup");
  }

  async function handleSignout() {
    if (
      !confirm(
        "Sign out and clear all LCKED config from this device?\n\nEncrypted entries on the server are NOT deleted."
      )
    )
      return;
    setFooterStatus("Signing out…");
    await bg("LOGOUT_SUPABASE");
    allItems = [];
    activeDomain = "";
    setFooterStatus("Signed out");
    showState("setup");
  }

  // ---- password visibility toggles -----------------------------------
  function bindEyeToggles() {
    $$("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-toggle");
        const input = document.getElementById(id);
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
      });
    });
  }

  // ---- boot ----------------------------------------------------------
  async function boot() {
    bindEyeToggles();

    $("#setupBtn").addEventListener("click", handleSetup);
    $("#unlockBtn").addEventListener("click", handleUnlock);
    $("#unlock-pass").addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleUnlock();
    });
    $("#su-master").addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSetup();
    });
    $("#su-pass").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("su-master").focus();
    });

    $("#lockBtn").addEventListener("click", async () => {
      await bg("LOCK");
      allItems = [];
      setFooterStatus("Locked");
      showState("unlock");
    });
    $("#settingsBtn").addEventListener("click", openSettings);
    $("#settingsBack").addEventListener("click", closeSettings);
    $("#refreshBtn").addEventListener("click", handleRefresh);
    $("#resetBtn").addEventListener("click", handleReset);
    $("#signoutBtn").addEventListener("click", handleSignout);
    $("#signoutBtn2").addEventListener("click", handleSignout);

    $("#search").addEventListener("input", (e) => {
      renderVault(e.target.value || "");
    });

    const status = await bg("GET_VAULT_STATUS");
    if (!status || !status.configured) {
      showState("setup");
      setFooterStatus("Not connected");
      return;
    }
    if (!status.unlocked) {
      showState("unlock");
      setFooterStatus("Locked");
      setTimeout(() => $("#unlock-pass").focus(), 50);
      return;
    }
    showState("vault");
    await loadVault();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();

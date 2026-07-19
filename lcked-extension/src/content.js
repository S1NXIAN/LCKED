// src/content.js
// LCKED content script — runs in the page's isolated world.
//
// Responsibilities:
//   * Smart login-form detection (password + username fields).
//   * Autofill badge attached to each detected password field (repositions
//     on scroll / resize / DOM mutation).
//   * Native input-event filling (React / Vue / Svelte compatible).
//   * Submit detection for both <form> submits and SPA button clicks.
//   * Update + Save prompt modals (Mocha themed).
//   * Bottom-right toast notifications.
//   * MutationObserver for SPA-rendered forms.
//   * Message listener: AUTOFILL, DETECT_SAVE, NOTIFY.

(() => {
  "use strict";

  if (window.__lckedContentInit) return;
  window.__lckedContentInit = true;

  // ---- Mocha palette (Catppuccin) --------------------------------------

  const MOCHA = {
    base: "#1e1e2e",
    mantle: "#181825",
    crust: "#11111b",
    text: "#cdd6f4",
    subtext: "#a6adc8",
    overlay0: "#6c7086",
    surface0: "#313244",
    surface1: "#45475a",
    mauve: "#cba6f7",
    lavender: "#b4befe",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    red: "#f38ba8",
    peach: "#fab387",
    blue: "#89b4fa",
  };

  // ---- CSS injection (scoped via data-lcked-ext) ----------------------

  const STYLE_ID = "lcked-ext-style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
[data-lcked-ext-badge] {
  position: fixed;
  z-index: 2147483646;
  width: 22px;
  height: 22px;
  margin: 6px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: ${MOCHA.mauve};
  color: ${MOCHA.crust};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset;
  opacity: 0;
  transition: opacity 0.12s ease, transform 0.12s ease;
  pointer-events: auto;
}
[data-lcked-ext-badge]:hover { transform: scale(1.12); opacity: 1 !important; }
[data-lcked-ext-badge] svg { width: 12px; height: 12px; display: block; }
[data-lcked-ext-badge].lcked-visible { opacity: 0.9; }

[data-lcked-ext-overlay] {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: rgba(17,17,27,0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  animation: lcked-fade-in 0.12s ease;
}
[data-lcked-ext-modal] {
  width: 360px;
  max-width: calc(100vw - 32px);
  background: ${MOCHA.base};
  color: ${MOCHA.text};
  border: 1px solid ${MOCHA.surface1};
  border-radius: 14px;
  box-shadow: 0 18px 60px rgba(0,0,0,0.55);
  overflow: hidden;
  font-size: 13px;
  line-height: 1.45;
}
[data-lcked-ext-modal] .lcked-head {
  padding: 14px 16px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid ${MOCHA.surface0};
  background: ${MOCHA.mantle};
}
[data-lcked-ext-modal] .lcked-mark {
  width: 22px; height: 22px;
  border-radius: 6px;
  background: ${MOCHA.mauve};
  display: flex; align-items: center; justify-content: center;
  color: ${MOCHA.crust};
  flex: 0 0 auto;
}
[data-lcked-ext-modal] .lcked-mark svg { width: 12px; height: 12px; }
[data-lcked-ext-modal] .lcked-title {
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.01em;
}
[data-lcked-ext-modal] .lcked-body { padding: 14px 16px; }
[data-lcked-ext-modal] .lcked-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 6px 0;
  border-bottom: 1px dashed ${MOCHA.surface0};
}
[data-lcked-ext-modal] .lcked-row:last-child { border-bottom: none; }
[data-lcked-ext-modal] .lcked-label {
  color: ${MOCHA.subtext};
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
[data-lcked-ext-modal] .lcked-value {
  color: ${MOCHA.text};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-lcked-ext-modal] .lcked-foot {
  display: flex; gap: 8px; padding: 12px 16px;
  background: ${MOCHA.mantle};
  border-top: 1px solid ${MOCHA.surface0};
}
[data-lcked-ext-modal] button.lcked-btn {
  flex: 1;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid ${MOCHA.surface1};
  background: ${MOCHA.surface0};
  color: ${MOCHA.text};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.1s ease, border-color 0.1s ease, color 0.1s ease;
}
[data-lcked-ext-modal] button.lcked-btn:hover { background: ${MOCHA.surface1}; }
[data-lcked-ext-modal] button.lcked-btn-primary {
  background: ${MOCHA.mauve};
  border-color: ${MOCHA.mauve};
  color: ${MOCHA.crust};
}
[data-lcked-ext-modal] button.lcked-btn-primary:hover {
  background: ${MOCHA.lavender};
  border-color: ${MOCHA.lavender};
}
[data-lcked-ext-modal] button.lcked-btn-danger {
  background: transparent;
  border-color: ${MOCHA.red};
  color: ${MOCHA.red};
}

[data-lcked-ext-toast-wrap] {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  display: flex; flex-direction: column; gap: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  pointer-events: none;
}
[data-lcked-ext-toast] {
  min-width: 240px;
  max-width: 360px;
  padding: 10px 12px 10px 14px;
  border-radius: 10px;
  background: ${MOCHA.base};
  color: ${MOCHA.text};
  border: 1px solid ${MOCHA.surface1};
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  display: flex; align-items: center; gap: 10px;
  font-size: 12px;
  pointer-events: auto;
  animation: lcked-toast-in 0.16s ease;
}
[data-lcked-ext-toast].lcked-leaving { animation: lcked-toast-out 0.16s ease forwards; }
[data-lcked-ext-toast] .lcked-dot {
  width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto;
}
[data-lcked-ext-toast].lcked-info .lcked-dot { background: ${MOCHA.blue}; }
[data-lcked-ext-toast].lcked-success .lcked-dot { background: ${MOCHA.green}; }
[data-lcked-ext-toast].lcked-error .lcked-dot { background: ${MOCHA.red}; }
[data-lcked-ext-toast].lcked-warn .lcked-dot { background: ${MOCHA.yellow}; }

@keyframes lcked-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes lcked-toast-in {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes lcked-toast-out {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(8px); }
}
`;
    (document.head || document.documentElement).appendChild(style);
  }

  // ---- tiny helpers ----------------------------------------------------

  const bg = (type, payload = {}) =>
    new Promise((resolve) => {
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

  const isVisible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(el);
    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      style.opacity === "0"
    )
      return false;
    // Offscreen check (allow slightly offscreen so hidden-by-scroll still counts)
    if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return false;
    return true;
  };

  const SVG_KEY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4"/><path d="m18 5 2 2"/><path d="m15 8 2 2"/></svg>`;
  const SVG_DIAMOND = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12Z"/><circle cx="12" cy="9" r="1.6" fill="#11111b"/><path d="M11 10.5h2L12 14Z" fill="#11111b"/></svg>`;

  function sendMessage(type, payload) {
    return bg(type, payload);
  }

  // ---- form detection --------------------------------------------------

  const USERNAME_HINTS =
    /(user|email|login|account|mail|identifier|uname|userid|user_id|signinname|authname|customer|nick)/i;
  const USERNAME_TYPES = new Set(["text", "email", "tel", "", null]);

  function isUsernameField(el) {
    if (!el || el.tagName !== "INPUT") return false;
    if (!USERNAME_TYPES.has(el.type)) return false;
    if (el.type === "password") return false;
    if (el.autocomplete && /username|email/.test(el.autocomplete)) return true;
    const sig = `${el.name || ""} ${el.id || ""} ${el.placeholder || ""} ${
      el.getAttribute("aria-label") || ""
    }`;
    return USERNAME_HINTS.test(sig);
  }

  function findPasswordFields() {
    return Array.from(
      document.querySelectorAll('input[type="password"]')
    ).filter(isVisible);
  }

  /**
   * For a given password field, find the most likely username field by
   * walking backwards through the form (or the document) and preferring
   * fields with autocomplete=username / email, then by hint regex.
   */
  function findUsernameField(passwordField) {
    const form = passwordField.form;
    let pool = [];
    if (form) {
      pool = Array.from(form.querySelectorAll("input"));
    } else {
      // Walk previous siblings + ancestors' previous siblings.
      let node = passwordField;
      while (node && pool.length < 50) {
        let prev = node.previousElementSibling;
        while (prev) {
          if (prev.tagName === "INPUT") pool.unshift(prev);
          else pool.unshift(...Array.from(prev.querySelectorAll("input")).reverse());
          prev = prev.previousElementSibling;
        }
        node = node.parentElement;
      }
    }
    // Best score wins.
    let best = null;
    let bestScore = 0;
    for (const el of pool) {
      if (el === passwordField) continue;
      if (el.type === "password") continue;
      if (!isVisible(el)) continue;
      if (!USERNAME_TYPES.has(el.type)) continue;
      let score = 0;
      const ac = el.autocomplete || "";
      if (/username/i.test(ac)) score += 50;
      if (/email/i.test(ac)) score += 40;
      const sig = `${el.name || ""} ${el.id || ""} ${el.placeholder || ""} ${
        el.getAttribute("aria-label") || ""
      }`;
      if (USERNAME_HINTS.test(sig)) score += 20;
      if (el.type === "email") score += 15;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  /** Returns an array of detected login candidates. */
  function detectLoginForms() {
    const passwords = findPasswordFields();
    const seen = new Set();
    const candidates = [];
    for (const pw of passwords) {
      if (seen.has(pw)) continue;
      seen.add(pw);
      const username = findUsernameField(pw);
      candidates.push({ passwordField: pw, usernameField: username });
    }
    return candidates;
  }

  // ---- filling (React/Vue compatible) ---------------------------------

  function setNativeValue(el, value) {
    if (!el) return;
    const proto = el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value");
    if (setter && setter.set) {
      setter.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    // Some frameworks (e.g. Vue 3) also listen to 'blur' to validate.
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function fillForm(credentials) {
    const candidates = detectLoginForms();
    if (candidates.length === 0) {
      notify("error", "No login form found on this page.");
      return false;
    }
    // Prefer the candidate whose username field currently has focus or matches.
    let target = candidates[0];
    const active = document.activeElement;
    if (active) {
      const hit = candidates.find(
        (c) => c.passwordField === active || c.usernameField === active
      );
      if (hit) target = hit;
    }
    if (credentials.username && target.usernameField) {
      setNativeValue(target.usernameField, credentials.username);
      target.usernameField.focus();
    }
    if (credentials.password && target.passwordField) {
      setNativeValue(target.passwordField, credentials.password);
    }
    notify("success", `Filled ${credentials.name || credentials.domain || "login"}`);
    return true;
  }

  // ---- autofill badge --------------------------------------------------

  const badgeFields = new WeakMap(); // field -> badge element

  function ensureBadge(field) {
    if (badgeFields.has(field)) return badgeFields.get(field);
    const badge = document.createElement("button");
    badge.setAttribute("data-lcked-ext-badge", "");
    badge.setAttribute("type", "button");
    badge.setAttribute("title", "Auto-fill with LCKED");
    badge.setAttribute("aria-label", "Auto-fill with LCKED");
    badge.innerHTML = SVG_KEY;
    badge.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const domain = location.hostname;
      const resp = await sendMessage("GET_ITEMS_FOR_DOMAIN", { domain });
      if (!resp || !resp.ok) {
        notify("error", "Vault is locked. Open the LCKED popup to unlock.");
        return;
      }
      const items = resp.items || [];
      if (items.length === 0) {
        notify("info", "No LCKED credentials saved for this site.");
        return;
      }
      if (items.length === 1) {
        fillForm(items[0]);
        return;
      }
      // Multiple matches → fill with the most-recently updated and toast.
      const chosen = items.reduce((a, b) =>
        (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a
      );
      fillForm(chosen);
      notify(
        "info",
        `${items.length} matches — filled most recent. Use the popup to choose another.`
      );
    });
    badgeFields.set(field, badge);
    document.documentElement.appendChild(badge);
    positionBadge(field, badge);
    return badge;
  }

  function positionBadge(field, badge) {
    const rect = field.getBoundingClientRect();
    badge.style.top = `${rect.top + 4}px`;
    badge.style.left = `${rect.right - 30}px`;
    if (rect.width > 0 && rect.height > 0 && isVisible(field)) {
      badge.classList.add("lcked-visible");
    } else {
      badge.classList.remove("lcked-visible");
    }
  }

  function repositionAllBadges() {
    badgeFields.forEach((badge, field) => positionBadge(field, badge));
  }

  function scanForBadges() {
    const passwords = findPasswordFields();
    for (const pw of passwords) ensureBadge(pw);
    // Remove badges for fields that disappeared.
    badgeFields.forEach((badge, field) => {
      if (!document.contains(field) || !isVisible(field)) {
        badge.remove();
        badgeFields.delete(field);
      }
    });
  }

  // ---- submit detection (form + SPA) ----------------------------------

  let lastCaptured = null; // { domain, username, password, name }

  function captureCredentials(passwordField, usernameField) {
    const username = usernameField ? usernameField.value : "";
    const password = passwordField ? passwordField.value : "";
    if (!password) return null;
    return {
      domain: location.hostname,
      name: document.title || location.hostname,
      username,
      password,
    };
  }

  async function offerSaveOrUpdate(creds) {
    if (!creds || !creds.password) return;
    lastCaptured = creds;
    const resp = await sendMessage("CHECK_UPDATE", creds);
    if (!resp || !resp.ok) return;
    if (resp.action === "noop") return; // already saved identical
    if (resp.action === "update") {
      showUpdateModal(creds, resp.itemId);
    } else {
      showSaveModal(creds);
    }
  }

  function hookFormSubmit(candidate) {
    const { passwordField, usernameField } = candidate;
    const form = passwordField.form;
    if (form && !form.__lckedHooked) {
      form.__lckedHooked = true;
      form.addEventListener(
        "submit",
        () => {
          const creds = captureCredentials(passwordField, usernameField);
          // Defer so the framework finishes its own submit handler.
          setTimeout(() => offerSaveOrUpdate(creds), 250);
        },
        true
      );
    }
  }

  // SPA: watch for clicks on likely submit buttons near a password field.
  const SUBMIT_TEXT = /^(sign in|log in|login|continue|submit|next|sign-in|log-in|get started|verify|go)$/i;

  function findSubmitButtonNear(passwordField) {
    const form = passwordField.form;
    if (form) {
      const btns = form.querySelectorAll('button, [role="button"], input[type="submit"]');
      for (const b of btns) {
        const t = (b.textContent || b.value || "").trim();
        if (SUBMIT_TEXT.test(t) || b.type === "submit") return b;
      }
    }
    // Walk up to the nearest containing block and search within.
    let scope = passwordField.parentElement;
    for (let i = 0; i < 4 && scope; i++) {
      const btns = scope.querySelectorAll('button, [role="button"], input[type="submit"]');
      for (const b of btns) {
        const t = (b.textContent || b.value || "").trim();
        if (SUBMIT_TEXT.test(t) || b.type === "submit") return b;
      }
      scope = scope.parentElement;
    }
    return null;
  }

  function hookSpaSubmit(candidate) {
    const { passwordField, usernameField } = candidate;
    const btn = findSubmitButtonNear(passwordField);
    if (btn && !btn.__lckedHooked) {
      btn.__lckedHooked = true;
      btn.addEventListener(
        "click",
        () => {
          const creds = captureCredentials(passwordField, usernameField);
          setTimeout(() => offerSaveOrUpdate(creds), 400);
        },
        true
      );
    }
    // Also: Enter key in the password field.
    if (!passwordField.__lckedEnterHooked) {
      passwordField.__lckedEnterHooked = true;
      passwordField.addEventListener(
        "keydown",
        (ev) => {
          if (ev.key === "Enter") {
            const creds = captureCredentials(passwordField, usernameField);
            setTimeout(() => offerSaveOrUpdate(creds), 400);
          }
        },
        true
      );
    }
  }

  function scanForForms() {
    const candidates = detectLoginForms();
    for (const c of candidates) {
      hookFormSubmit(c);
      hookSpaSubmit(c);
    }
  }

  // ---- modals ----------------------------------------------------------

  function ensureOverlay() {
    let overlay = document.querySelector("[data-lcked-ext-overlay]");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.setAttribute("data-lcked-ext-overlay", "");
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) overlay.remove();
    });
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function buildModal({ title, bodyHtml, footerHtml }) {
    const overlay = ensureOverlay();
    overlay.innerHTML = "";
    const modal = document.createElement("div");
    modal.setAttribute("data-lcked-ext-modal", "");
    modal.innerHTML = `
      <div class="lcked-head">
        <div class="lcked-mark">${SVG_DIAMOND}</div>
        <div class="lcked-title">${title}</div>
      </div>
      <div class="lcked-body">${bodyHtml}</div>
      <div class="lcked-foot">${footerHtml}</div>
    `;
    overlay.appendChild(modal);
    return { overlay, modal };
  }

  function row(label, value) {
    const v = value || "—";
    return `<div class="lcked-row"><span class="lcked-label">${label}</span><span class="lcked-value" title="${escapeHtml(
      v
    )}">${escapeHtml(v)}</span></div>`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showSaveModal(creds) {
    const { overlay, modal } = buildModal({
      title: "Save login?",
      bodyHtml: `
        ${row("Website", creds.domain)}
        ${row("Username", creds.username || "(none)")}
        ${row("Password", "•".repeat(Math.min(creds.password.length, 16)))}
      `,
      footerHtml: `
        <button class="lcked-btn" data-lcked-act="skip">Not now</button>
        <button class="lcked-btn lcked-btn-primary" data-lcked-act="save">Save</button>
      `,
    });
    modal.querySelector('[data-lcked-act="skip"]').addEventListener("click", () => overlay.remove());
    modal.querySelector('[data-lcked-act="save"]').addEventListener("click", async () => {
      const resp = await sendMessage("SAVE_CREDENTIAL", creds);
      overlay.remove();
      if (resp && resp.ok) notify("success", "Login saved to LCKED.");
      else notify("error", (resp && resp.error) || "Save failed.");
    });
  }

  function showUpdateModal(creds, itemId) {
    const { overlay, modal } = buildModal({
      title: "Update password?",
      bodyHtml: `
        <div style="color:${MOCHA.subtext};font-size:12px;margin-bottom:8px;">
          LCKED detected a different password for
          <strong style="color:${MOCHA.text};">${escapeHtml(creds.username || "(no username)")}</strong>
          on <strong style="color:${MOCHA.text};">${escapeHtml(creds.domain)}</strong>.
        </div>
        ${row("New password", "•".repeat(Math.min(creds.password.length, 16)))}
      `,
      footerHtml: `
        <button class="lcked-btn" data-lcked-act="skip">Skip</button>
        <button class="lcked-btn lcked-btn-primary" data-lcked-act="update">Update</button>
      `,
    });
    modal.querySelector('[data-lcked-act="skip"]').addEventListener("click", () => overlay.remove());
    modal.querySelector('[data-lcked-act="update"]').addEventListener("click", async () => {
      const resp = await sendMessage("SAVE_CREDENTIAL", { ...creds, id: itemId });
      overlay.remove();
      if (resp && resp.ok) notify("success", "Password updated in LCKED.");
      else notify("error", (resp && resp.error) || "Update failed.");
    });
  }

  // ---- toast notifications --------------------------------------------

  function ensureToastWrap() {
    let wrap = document.querySelector("[data-lcked-ext-toast-wrap]");
    if (wrap) return wrap;
    wrap = document.createElement("div");
    wrap.setAttribute("data-lcked-ext-toast-wrap", "");
    document.documentElement.appendChild(wrap);
    return wrap;
  }

  function notify(level, message) {
    const wrap = ensureToastWrap();
    const toast = document.createElement("div");
    toast.setAttribute("data-lcked-ext-toast", "");
    toast.className = `lcked-${level || "info"}`;
    toast.innerHTML = `<span class="lcked-dot"></span><span>${escapeHtml(message)}</span>`;
    wrap.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("lcked-leaving");
      setTimeout(() => toast.remove(), 180);
    }, 3000);
  }

  // ---- message listener ------------------------------------------------

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      if (!msg || !msg.type) return;
      switch (msg.type) {
        case "AUTOFILL": {
          if (msg.credentials) fillForm(msg.credentials);
          else notify("error", "No credentials supplied.");
          sendResponse({ ok: true });
          break;
        }
        case "DETECT_SAVE": {
          const candidates = detectLoginForms();
          if (candidates.length === 0) {
            notify("info", "No login form detected on this page.");
            sendResponse({ ok: false, error: "no-form" });
            break;
          }
          // Prefer the candidate whose password field has a value.
          let target = candidates.find((c) => c.passwordField.value);
          if (!target) target = candidates[0];
          const creds = captureCredentials(target.passwordField, target.usernameField);
          if (!creds || !creds.password) {
            notify("info", "Enter your password first, then try again.");
            sendResponse({ ok: false, error: "no-credentials" });
            break;
          }
          await offerSaveOrUpdate(creds);
          sendResponse({ ok: true });
          break;
        }
        case "NOTIFY": {
          notify(msg.level || "info", msg.message || "");
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: `Unknown: ${msg.type}` });
      }
    })();
    return true;
  });

  // ---- MutationObserver + listeners -----------------------------------

  let scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanForForms();
      scanForBadges();
      repositionAllBadges();
    }, 300);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
  });

  let scrollTimer = null;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollTimer) return;
      scrollTimer = requestAnimationFrame(() => {
        scrollTimer = null;
        repositionAllBadges();
      });
    },
    { passive: true, capture: true }
  );
  window.addEventListener("resize", repositionAllBadges, { passive: true });

  // Initial scan.
  if (document.readyState === "complete" || document.readyState === "interactive") {
    scheduleScan();
  } else {
    document.addEventListener("DOMContentLoaded", scheduleScan, { once: true });
  }

  // Re-scan periodically for late-rendered SPAs (cheap, debounced).
  setInterval(scheduleScan, 2000);
})();

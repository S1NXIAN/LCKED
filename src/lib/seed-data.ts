/**
 * LCKED — Demo seed data
 * ---------------------------------------------------------------------------
 * Deterministic demo vaults + items used by the "Try the demo" / first-run
 * flow. Every value here is a PUBLIC, NON-SENSITIVE placeholder:
 *
 *   • Passwords are obviously fake ("Demo!Pass-...-2024")
 *   • Cards are Stripe's published test-card numbers (https://stripe.com/docs/testing)
 *   • TOTP secrets use RFC 4226 / 6238 test vectors (ASCII "12345678901234567890"
 *     → Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")
 *   • Email/phone numbers use the 555-01xx reserved range
 *
 * Nothing here is a real credential. Consumers should still purge the seed
 * vault before the user stores real data — typically a one-time call to the
 * store's `wipe()` on first master-password change.
 *
 * The seed deliberately exercises every edge case the UI must handle:
 *   • Empty fields (username / password / URLs / notes)
 *   • Very long names (50+ chars) + very short names (1–2 chars)
 *   • Unicode / emoji / quote characters in names
 *   • Multiple URLs, many custom fields, hidden (masked) custom fields
 *   • Multi-line notes, all 4 card brands, partial identities
 *   • Items in every vault incl. "no vault" (vaultId=null)
 *   • Favorite items (which double as the ⌘1–⌘9 pinned set)
 *   • Multiple trashed items with different `trashedAt` timestamps
 *   • TOTP-enabled logins
 */

import type { CustomField, NewItemInput, VaultDef } from "@/lib/types";

/** Public RFC 4226 / 6238 TOTP test secret in Base32. */
const RFC_TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

/** Stable vault ids so seed items can reference them. */
export const SEED_VAULT_IDS = {
  personal: "seed-vault-personal",
  work: "seed-vault-work",
  finance: "seed-vault-finance",
} as const;

/**
 * Three demo vaults. Colors + icons come from the catalogs in
 * `src/lib/vault-assets.ts` (heliotrope / jordy-blue / de-york, heart /
 * briefcase / banknote) so they render with the same palette as user-created
 * vaults. `createdAt` is anchored to the call site so the demo always looks
 * fresh relative to "now".
 */
export function getSeedVaults(now: number): VaultDef[] {
  return [
    {
      id: SEED_VAULT_IDS.personal,
      name: "Personal",
      color: "heliotrope",
      icon: "heart",
      createdAt: now,
    },
    {
      id: SEED_VAULT_IDS.work,
      name: "Work",
      color: "jordy-blue",
      icon: "briefcase",
      createdAt: now,
    },
    {
      id: SEED_VAULT_IDS.finance,
      name: "Finance",
      color: "de-york",
      icon: "bank",
      createdAt: now,
    },
  ];
}

/**
 * 27 diverse demo items — full edge-case coverage.
 *
 * Spread:
 *   • 15 logins, 4 notes, 4 cards (all 4 brands), 4 identities (incl. partial).
 *   • 7 favorites (GitHub, AWS, ChatGPT, Steam, Reddit, VPN, Home Wi-Fi note,
 *     Visa test card, Work identity). Favorites double as the "pinned" set for
 *     ⌘1–⌘9 — the schema doesn't yet have a dedicated `pinned` flag, so
 *     favorite IS the pin.
 *   • 3 trashed items with different `trashedAt` timestamps (2 days / 5 days /
 *     12 days ago) so the trash view can be sorted by deletion time.
 *   • 4 vaults: Personal / Work / Finance / "no vault" (vaultId=null).
 *   • Edge cases: empty username, empty password, empty URLs, very long name
 *     (60 chars), very short name (3 chars), emoji/unicode/quotes, multiple
 *     URLs, 6 custom fields, hidden custom fields, multi-line notes, partial
 *     identities, TOTP on multiple logins.
 *
 * Each item is a plain `NewItemInput` — pass it straight to `saveItem()` (the
 * store will mint ids/timestamps) or to `importItems` via a synthesized CSV.
 * `trashed` / `trashedAt` are honored by direct DB writes; the standard
 * `saveItem` flow clamps new items to `trashed=false` because soft-delete is
 * normally a user action — consumers that want to preserve the trashed seed
 * state should call `trashItem(id)` after seeding.
 */
export function getSeedItems(now: number): NewItemInput[] {
  const dayMs = 86_400_000;
  // Helper that stamps the common trashed / vaultId fields so each entry below
  // stays focused on its own payload. `trashedAt` defaults to "yesterday" but
  // can be overridden per-item to spread trashed items across time.
  const withBase = (
    item: NewItemInput,
    opts: {
      vaultId: string | null;
      favorite?: boolean;
      pinned?: boolean;
      trashed?: boolean;
      trashedAt?: number;
    },
  ): NewItemInput => ({
    ...item,
    vaultId: opts.vaultId,
    favorite: opts.favorite ?? false,
    pinned: opts.pinned ?? false,
    trashed: opts.trashed ?? false,
    trashedAt: opts.trashed ?? false ? (opts.trashedAt ?? now - dayMs) : null,
  });

  const login = (
    o: {
      name: string;
      username: string;
      password: string;
      urls: string[];
      totp?: string;
      notes?: string;
      customFields?: CustomField[];
      vaultId: string | null;
      favorite?: boolean;
      pinned?: boolean;
      trashed?: boolean;
      trashedAt?: number;
    },
  ): NewItemInput =>
    withBase(
      {
        type: "login",
        name: o.name,
        favorite: o.favorite ?? false,
        pinned: o.pinned ?? false,
        folder: "",
        customFields: o.customFields ?? [],
        vaultId: o.vaultId,
        trashed: o.trashed ?? false,
        trashedAt: o.trashed ? (o.trashedAt ?? now - dayMs) : null,
        details: {
          username: o.username,
          password: o.password,
          urls: o.urls,
          totp: o.totp ?? "",
          notes: o.notes ?? "",
        },
      },
      {
        vaultId: o.vaultId,
        favorite: o.favorite,
        pinned: o.pinned,
        trashed: o.trashed,
        trashedAt: o.trashedAt,
      },
    );

  const note = (
    o: {
      name: string;
      content: string;
      customFields?: CustomField[];
      vaultId: string | null;
      favorite?: boolean;
      pinned?: boolean;
      trashed?: boolean;
      trashedAt?: number;
    },
  ): NewItemInput =>
    withBase(
      {
        type: "note",
        name: o.name,
        favorite: o.favorite ?? false,
        pinned: o.pinned ?? false,
        folder: "",
        customFields: o.customFields ?? [],
        vaultId: o.vaultId,
        trashed: o.trashed ?? false,
        trashedAt: o.trashed ? (o.trashedAt ?? now - dayMs) : null,
        details: { content: o.content },
      },
      {
        vaultId: o.vaultId,
        favorite: o.favorite,
        pinned: o.pinned,
        trashed: o.trashed,
        trashedAt: o.trashedAt,
      },
    );

  const card = (
    o: {
      name: string;
      cardholder: string;
      number: string;
      brand: string;
      cvv: string;
      expiry: string;
      pin?: string;
      notes?: string;
      customFields?: CustomField[];
      vaultId: string | null;
      favorite?: boolean;
      pinned?: boolean;
      trashed?: boolean;
      trashedAt?: number;
    },
  ): NewItemInput =>
    withBase(
      {
        type: "card",
        name: o.name,
        favorite: o.favorite ?? false,
        pinned: o.pinned ?? false,
        folder: "",
        customFields: o.customFields ?? [],
        vaultId: o.vaultId,
        trashed: o.trashed ?? false,
        trashedAt: o.trashed ? (o.trashedAt ?? now - dayMs) : null,
        details: {
          cardholder: o.cardholder,
          number: o.number,
          brand: o.brand,
          cvv: o.cvv,
          expiry: o.expiry,
          pin: o.pin ?? "",
          notes: o.notes ?? "",
        },
      },
      {
        vaultId: o.vaultId,
        favorite: o.favorite,
        pinned: o.pinned,
        trashed: o.trashed,
        trashedAt: o.trashedAt,
      },
    );

  const identity = (
    o: {
      name: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      company?: string;
      address1?: string;
      address2?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      notes?: string;
      customFields?: CustomField[];
      vaultId: string | null;
      favorite?: boolean;
      pinned?: boolean;
      trashed?: boolean;
      trashedAt?: number;
    },
  ): NewItemInput =>
    withBase(
      {
        type: "identity",
        name: o.name,
        favorite: o.favorite ?? false,
        pinned: o.pinned ?? false,
        folder: "",
        customFields: o.customFields ?? [],
        vaultId: o.vaultId,
        trashed: o.trashed ?? false,
        trashedAt: o.trashed ? (o.trashedAt ?? now - dayMs) : null,
        details: {
          firstName: o.firstName ?? "",
          lastName: o.lastName ?? "",
          email: o.email ?? "",
          phone: o.phone ?? "",
          company: o.company ?? "",
          address1: o.address1 ?? "",
          address2: o.address2 ?? "",
          city: o.city ?? "",
          state: o.state ?? "",
          zip: o.zip ?? "",
          country: o.country ?? "",
          notes: o.notes ?? "",
        },
      },
      {
        vaultId: o.vaultId,
        favorite: o.favorite,
        pinned: o.pinned,
        trashed: o.trashed,
        trashedAt: o.trashedAt,
      },
    );

  return [
    /* ============================ 15 logins ============================= */

    // Core logins — typical shape, spread across all 3 vaults.
    login({
      name: "GitHub",
      username: "dev-demouser",
      password: "Demo!Pass-GitHub-2024",
      urls: ["https://github.com"],
      totp: RFC_TOTP_SECRET,
      notes: "Demo account for testing imports.",
      vaultId: SEED_VAULT_IDS.work,
      favorite: true,
      pinned: true, // starred + pinned — tests graceful coexistence
    }),
    login({
      name: "Gmail",
      username: "demouser.lcked",
      password: "GmailDemo#2024!",
      urls: ["https://mail.google.com"],
      vaultId: SEED_VAULT_IDS.personal,
      pinned: true, // pinned-only (not favorited) — tests pin sort below favorites
    }),
    login({
      name: "AWS Console",
      username: "demo-aws-root",
      password: "AwsRoot-Demo!2024",
      urls: ["https://console.aws.amazon.com"],
      totp: RFC_TOTP_SECRET,
      notes: "IAM user demo.",
      vaultId: SEED_VAULT_IDS.work,
      favorite: true,
    }),
    login({
      name: "Figma",
      username: "designer@lcked.app",
      password: "FigmaDemo-2024!",
      urls: ["https://www.figma.com"],
      vaultId: SEED_VAULT_IDS.work,
    }),
    login({
      name: "ChatGPT",
      username: "ai-demo@lcked.app",
      password: "ChatGPTDemo!2024",
      urls: ["https://chat.openai.com"],
      totp: RFC_TOTP_SECRET,
      vaultId: SEED_VAULT_IDS.work,
      favorite: true,
    }),
    login({
      name: "Steam",
      username: "lcked_gamer",
      password: "SteamDemo-2024!",
      urls: ["https://store.steampowered.com"],
      vaultId: SEED_VAULT_IDS.personal,
      favorite: true,
    }),
    login({
      name: "Reddit",
      username: "lcked_redditor",
      password: "RedditDemo!2024",
      urls: ["https://www.reddit.com"],
      vaultId: SEED_VAULT_IDS.personal,
      favorite: true,
    }),

    // Edge case — very short name (3 chars) + TOTP + favorite.
    login({
      name: "VPN",
      username: "demo@lcked.app",
      password: "VpnDemo-Tunnel!2024",
      urls: ["https://vpn.lcked.app"],
      totp: RFC_TOTP_SECRET,
      notes: "WireGuard config portal.",
      vaultId: SEED_VAULT_IDS.personal,
      favorite: true,
    }),

    // Edge case — very long name (60 chars, well over the 50+ requirement).
    login({
      name: "Bank of America — Online Banking Login Portal for Personal & Business Accounts",
      username: "demo.user@example.com",
      password: "BofaDemo-Secure!2024",
      urls: ["https://www.bankofamerica.com"],
      notes: "Use 2FA + SMS fallback if TOTP fails.",
      vaultId: SEED_VAULT_IDS.finance,
    }),

    // Edge case — special characters: émojis, ünïcödé, smart quotes, dashes.
    login({
      name: "Café Résumé — \"Ünïcödé\" Løgin ✨🎉",
      username: "café.user@lcked.app",
      password: "CaféDemo-Pässword!2024",
      urls: ["https://café-example.com"],
      notes: "Tests unicode rendering in list + detail views.",
      vaultId: SEED_VAULT_IDS.work,
    }),

    // Edge case — multiple URLs (3) for one login.
    login({
      name: "Microsoft 365",
      username: "demo@lcked.onmicrosoft.com",
      password: "MsftDemo-365!2024",
      urls: [
        "https://login.microsoftonline.com",
        "https://portal.office.com",
        "https://outlook.office.com",
      ],
      vaultId: SEED_VAULT_IDS.work,
    }),

    // Edge case — empty username (just a password store).
    login({
      name: "Router Admin (no user)",
      username: "",
      password: "RouterDemo-Admin!2024",
      urls: ["http://192.168.1.1"],
      notes: "Default gateway. Username left blank — admin-only login.",
      vaultId: null, // "no vault"
    }),

    // Edge case — empty password (TOTP-only service, or pending credential).
    login({
      name: "TOTP-Only Service",
      username: "totp.demo@lcked.app",
      password: "",
      urls: ["https://totp-only.lcked.app"],
      totp: RFC_TOTP_SECRET,
      notes: "Passwordless login — TOTP is the only credential.",
      vaultId: SEED_VAULT_IDS.personal,
    }),

    // Edge case — empty URLs (offline credential, no associated website).
    login({
      name: "Server SSH Key Passphrase",
      username: "ubuntu",
      password: "SshDemo-Passphrase!2024",
      urls: [],
      notes: "Passphrase for the demo SSH private key. No web URL.",
      vaultId: SEED_VAULT_IDS.work,
    }),

    // Edge case — many custom fields (6) including a hidden (masked) field.
    login({
      name: "Custom Fields Showcase",
      username: "demo.fields@lcked.app",
      password: "FieldsDemo!2024",
      urls: ["https://fields.lcked.app"],
      notes: "Exercises the custom-field editor + detail rendering.",
      customFields: [
        { name: "Recovery Code", value: "RC-DEMO-1234-5678-90AB", type: "text" },
        { name: "Security Question", value: "What is your favorite color?", type: "text" },
        { name: "Security Answer", value: "Cerulean", type: "hidden" },
        { name: "Backup Code 1", value: "BK-001-DEMO", type: "text" },
        { name: "Backup Code 2", value: "BK-002-DEMO", type: "text" },
        { name: "PIN", value: "0421", type: "hidden" },
      ],
      vaultId: SEED_VAULT_IDS.work,
    }),

    // Trashed login — 5 days ago.
    login({
      name: "Twitter / X",
      username: "lcked_demo",
      password: "TwitterDemo!2024",
      urls: ["https://x.com"],
      notes: "Old account, no longer used.",
      vaultId: SEED_VAULT_IDS.personal,
      trashed: true,
      trashedAt: now - 5 * dayMs,
    }),

    /* ============================= 4 notes ============================== */

    // Favorite note with multi-line content.
    note({
      name: "Home Wi-Fi",
      content:
        "SSID: LCKED-Demo-5G\nPassword: WifiDemo-2024!\nWPA2-PSK (CCMP)\nGuest network: LCKED-Guest (no password)",
      vaultId: SEED_VAULT_IDS.personal,
      favorite: true,
    }),

    // Multi-line runbook note (heading + bullets).
    note({
      name: "Server Runbook",
      content:
        "# Demo runbook\n\n## Restart\n- ssh ubuntu@10.0.0.42\n- systemctl restart lcked\n- tail -f /var/log/lcked.log\n\n## Health check\n- curl -s http://localhost:8080/health\n- curl -s http://localhost:8080/metrics | grep lcked_",
      vaultId: SEED_VAULT_IDS.work,
    }),

    // Trashed note — 2 days ago.
    note({
      name: "Old Project Notes",
      content: "Deprecated: see the new Finance vault instead.",
      vaultId: SEED_VAULT_IDS.finance,
      trashed: true,
      trashedAt: now - 2 * dayMs,
    }),

    // Trashed note — 12 days ago (approaching auto-purge window).
    note({
      name: "Recovery Codes (old)",
      content:
        "Old backup codes — rotate immediately:\n\n1. DEMO-OLD-AAAA-1111\n2. DEMO-OLD-BBBB-2222\n3. DEMO-OLD-CCCC-3333\n4. DEMO-OLD-DDDD-4444\n5. DEMO-OLD-EEEE-5555",
      vaultId: SEED_VAULT_IDS.personal,
      trashed: true,
      trashedAt: now - 12 * dayMs,
    }),

    /* ============================= 4 cards ============================= */
    // All 4 brands — uses Stripe's published test card numbers.

    card({
      name: "Visa Test Card",
      cardholder: "DEMO USER",
      number: "4242424242424242",
      brand: "Visa",
      cvv: "123",
      expiry: "12/34",
      notes: "Stripe published test card — never use for real charges.",
      vaultId: SEED_VAULT_IDS.finance,
      favorite: true,
    }),
    card({
      name: "Mastercard Test",
      cardholder: "DEMO USER",
      number: "5555555555554444",
      brand: "Mastercard",
      cvv: "321",
      expiry: "11/33",
      notes: "Stripe published test card.",
      vaultId: SEED_VAULT_IDS.finance,
    }),
    card({
      name: "Amex Test Card",
      cardholder: "DEMO USER",
      number: "378282246310005",
      brand: "Amex",
      cvv: "4321",
      expiry: "08/36",
      pin: "0421",
      notes: "Amex test card (15-digit number, 4-digit CVV).",
      vaultId: SEED_VAULT_IDS.finance,
    }),
    card({
      name: "Discover Test Card",
      cardholder: "DEMO USER",
      number: "6011111111111117",
      brand: "Discover",
      cvv: "567",
      expiry: "03/35",
      vaultId: SEED_VAULT_IDS.finance,
    }),

    /* =========================== 4 identities =========================== */

    // Full personal identity.
    identity({
      name: "Personal Identity",
      firstName: "Demo",
      lastName: "User",
      email: "demo@lcked.app",
      phone: "+1 (555) 010-1234",
      company: "",
      address1: "123 Demo Street",
      address2: "",
      city: "Springfield",
      state: "CA",
      zip: "90210",
      country: "United States",
      vaultId: SEED_VAULT_IDS.personal,
    }),

    // Full work identity — favorite.
    identity({
      name: "Work Identity",
      firstName: "Jane",
      lastName: "Developer",
      email: "jane.dev@lcked.app",
      phone: "+1 (555) 010-5678",
      company: "LCKED Demo Inc.",
      address1: "500 Business Ave",
      address2: "Suite 200",
      city: "San Francisco",
      state: "CA",
      zip: "94107",
      country: "United States",
      notes: "Primary work profile for autofill.",
      vaultId: SEED_VAULT_IDS.work,
      favorite: true,
    }),

    // Partial identity — only first name + email.
    identity({
      name: "Quick Contact",
      firstName: "Alex",
      email: "alex.quick@lcked.app",
      vaultId: null, // "no vault"
    }),

    // Partial identity — only email + phone (no name).
    identity({
      name: "Emergency Contact",
      email: "emergency@lcked.app",
      phone: "+1 (555) 010-9999",
      notes: "Partial — used only for emergency autofill scenarios.",
      vaultId: SEED_VAULT_IDS.personal,
    }),
  ];
}

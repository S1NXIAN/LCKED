/**
 * LCKED — Import Sources Catalog
 * ---------------------------------------------------------------------------
 * Single source of truth for all supported password-manager import sources.
 * Each entry maps a source id → label, icon path, accepted file hint, and
 * the import-export format id it routes to.
 *
 * To add a new password manager:
 *   1. Add an SVG icon to /public/icons/pm/<id>.svg
 *   2. Add an entry to this array
 *   3. Add a parser in src/lib/import-export.ts (if the format is new)
 *   4. Add detection logic in detectFormat() if needed
 *
 * No changes to settings-dialog.tsx or import-export-dialog.tsx are needed —
 * they both read from this catalog dynamically.
 */

export interface ImportSource {
  /** Unique id — also used as the icon filename (e.g. "bitwarden" → /icons/pm/bitwarden.svg). */
  id: string;
  /** Display name shown in the UI. */
  label: string;
  /** Path to the SVG icon (relative to /public). */
  icon: string;
  /** Accepted file format hint shown under the label. */
  hint: string;
}

export const IMPORT_SOURCES: ImportSource[] = [
  { id: "bitwarden", label: "Bitwarden", icon: "/icons/pm/bitwarden.svg", hint: "JSON / CSV" },
  { id: "1password", label: "1Password", icon: "/icons/pm/1password.svg", hint: "CSV" },
  { id: "chrome", label: "Chrome", icon: "/icons/pm/chrome.svg", hint: "CSV" },
  { id: "firefox", label: "Firefox", icon: "/icons/pm/firefox.svg", hint: "CSV" },
  { id: "proton-pass", label: "Proton Pass", icon: "/icons/pm/proton-pass.svg", hint: "CSV" },
  { id: "safari", label: "Safari", icon: "/icons/pm/safari.svg", hint: "CSV" },
  { id: "microsoft-edge", label: "Microsoft Edge", icon: "/icons/pm/microsoft-edge.svg", hint: "CSV" },
  { id: "lastpass", label: "LastPass", icon: "/icons/pm/lastpass.svg", hint: "CSV" },
  { id: "keeper-security", label: "Keeper", icon: "/icons/pm/keeper-security.svg", hint: "CSV" },
  { id: "keepassxc", label: "KeePassXC", icon: "/icons/pm/keepassxc.svg", hint: "XML" },
];

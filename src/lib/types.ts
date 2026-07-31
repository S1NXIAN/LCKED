/**
 * LCKED — Vault Item Type Definitions
 * ---------------------------------------------------------------------------
 * A discriminated union models the four supported item kinds.
 * Every concrete item is wrapped in an `EncryptedItem` envelope before it is
 * persisted to IndexedDB, so plaintext data never touches storage.
 */

export type ItemType = "login" | "note" | "card" | "identity";

/** A user-defined extra field (e.g. "Security Question" / "Recovery Code"). */
export interface CustomField {
  name: string;
  value: string;
  /** "text" renders plainly, "hidden" masks like a password. */
  type: "text" | "hidden";
}

/** Login item — websites, credentials, and optional TOTP secret. */
export interface LoginDetails {
  username: string;
  password: string;
  /** One or more URLs associated with the login. */
  urls: string[];
  /** Raw TOTP secret (base32) used to generate 6-digit codes. */
  totp: string;
  notes: string;
}

/** Secure note — free-form rich text. */
export interface NoteDetails {
  content: string;
}

/** Credit / debit card. */
export interface CardDetails {
  cardholder: string;
  /** Stored without separators, displayed masked. */
  number: string;
  /** Auto-detected brand, but user-editable. */
  brand: string;
  cvv: string;
  /** MM/YY format. */
  expiry: string;
  pin: string;
  notes: string;
}

/** Identity — personal info bundle. */
export interface IdentityDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  notes: string;
}

export interface BaseItem {
  id: string;
  type: ItemType;
  /** Display name shown in the list (also encrypted at rest). */
  name: string;
  favorite: boolean;
  /** Pinned items sort to the top of the list (below favorites when
   *  sortFavoritesFirst is on). Pin is a LOWER priority than favorite. */
  pinned: boolean;
  /** Logical grouping; empty string means "All Items" root. */
  folder: string;
  customFields: CustomField[];
  createdAt: number;
  updatedAt: number;
  /** Vaults this item belongs to (multi-vault membership). Empty array =
   *  "All Items" only (no specific vault). An item may belong to several
   *  vaults at once. Migrated from the old singular `vaultId: string | null`. */
  vaultIds: string[];
  /** Soft-delete flag — trashed items live 30 days before auto-purge. */
  trashed: boolean;
  /** Epoch ms when the item was trashed (null if not trashed). */
  trashedAt: number | null;
}

/** A user-defined vault (Proton Pass–style colored container for items). */
export interface VaultDef {
  id: string;
  name: string;
  /** Vault color id from VAULT_COLORS (see src/lib/vault-assets.ts). */
  color: string;
  /** Vault icon id from VAULT_ICONS (see src/lib/vault-assets.ts). */
  icon: string;
  createdAt: number;
}

export interface LoginItem extends BaseItem {
  type: "login";
  details: LoginDetails;
}
export interface NoteItem extends BaseItem {
  type: "note";
  details: NoteDetails;
}
export interface CardItem extends BaseItem {
  type: "card";
  details: CardDetails;
}
export interface IdentityItem extends BaseItem {
  type: "identity";
  details: IdentityDetails;
}

export type VaultItem = LoginItem | NoteItem | CardItem | IdentityItem;

/** Factory: produce a blank item of a given type with a fresh id. */
export type NewItemInput = Omit<VaultItem, "id" | "createdAt" | "updatedAt">;

/** What gets written to disk — ciphertext + non-sensitive metadata. */
export interface StoredItem {
  id: string;
  type: ItemType;
  /** AES-GCM ciphertext of the full VaultItem JSON. Base64. */
  ciphertext: string;
  /** 12-byte random IV per record, base64. */
  iv: string;
  createdAt: number;
  updatedAt: number;
}

/** Persisted vault metadata — everything needed to unlock (except the password). */
export interface VaultMeta {
  id: "singleton";
  /** 16-byte random salt, base64. */
  salt: string;
  /** KDF iteration count — stored so we can raise it later without breaking old vaults. */
  iterations: number;
  /** Random 256-bit vault key, encrypted with the master key. Base64 ciphertext. */
  encryptedVaultKey: string;
  /** IV for the encrypted vault key. */
  vaultKeyIv: string;
  /** Verifier: AES-GCM of a known plaintext, proves master password correctness. */
  verifier: string;
  verifierIv: string;
  /** Plaintext token encrypted/decrypted only with the correct master key. */
  verifierToken: string;
  createdAt: number;
  /** User settings (auto-lock timeout, etc.) stored alongside for convenience. */
  settings: VaultSettings;
  /** User-defined vaults (colored containers). Stored encrypted as part of the
   *  vault envelope, but the list itself is part of meta so it survives lock. */
  vaults: VaultDef[];
}

export interface VaultSettings {
  /** Auto-lock after N minutes of inactivity. 0 = never. */
  autoLockMinutes: number;
  /** Whether to lock when the tab loses visibility. */
  lockOnVisibility: boolean;
  /** Default password generator options. */
  generator: GeneratorOptions;
  /** Theme preference persisted across sessions. */
  theme: "dark" | "light";
  /** Whether login favicons are fetched (off = privacy / fully offline). */
  showFavicons: boolean;
  /** Whether favorite items sort to the top regardless of the active sort key. */
  sortFavoritesFirst: boolean;
  /** Whether item action buttons (restore/delete in trash) only show on hover. */
  hoverItemActions: boolean;
  /** Privacy blur for email/username fields in lists and detail.
   *  - "off":   no blur, emails always visible
   *  - "hover": blurred by default, reveals on hover (list) or when selected (detail)
   *  - "full":  always blurred in lists; detail hides the value until revealed */
  blurEmailMode: "off" | "hover" | "full";
}

export interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  /** Exclude visually ambiguous chars (0/O, 1/l/I, etc). */
  avoidAmbiguous: boolean;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};

export const DEFAULT_VAULT_SETTINGS: VaultSettings = {
  autoLockMinutes: 15,
  lockOnVisibility: true,
  generator: DEFAULT_GENERATOR_OPTIONS,
  theme: "dark",
  showFavicons: true,
  sortFavoritesFirst: false,
  hoverItemActions: true,
  blurEmailMode: "off",
};

/** UI filter applied over decrypted items. */
export type FilterType =
  | "all"
  | "trash"
  | ItemType
  | "favorites"
  | { vault: string };

/** Result of importing from a third-party file. */
export interface ImportResult {
  imported: number;
  skipped: number;
  warnings: string[];
  /** Set for formats that need follow-up (e.g. "lcked-json" for encrypted imports). */
  format?: ImportFormat;
  /** Raw envelope data for deferred processing (e.g. encrypted LCKED export). */
  raw?: any;
  /** Parsed items (internal — populated by parsers, exposed through importFromText). */
  items?: NewItemInput[];
}

export type ImportFormat =
  | "bitwarden-json"
  | "bitwarden-csv"
  | "1password-csv"
  | "protonpass-csv"
  | "keepassxc-xml"
  | "lcked-json";

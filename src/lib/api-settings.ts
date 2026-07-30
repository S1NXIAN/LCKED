/**
 * LCKED — API-level settings helpers
 * ---------------------------------------------------------------------------
 * Shared browser-side helpers extracted from the monolithic settings-dialog.
 */

/**
 * Dynamically load the Google Identity Services (GIS) script.
 * Returns a token client that can request an access token.
 * The GIS script is loaded from Google's CDN on demand.
 */
export function loadGoogleIdentity(): Promise<{
  requestAccessToken: (opts: {
    prompt: string;
    callback: (resp: { access_token: string; error?: string }) => void;
  }) => void;
}> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    const w = window as unknown as {
      google?: {
        accounts?: {
          oauth2?: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              callback: (resp: {
                access_token: string;
                error?: string;
              }) => void;
            }) => {
              requestAccessToken: (opts: { prompt: string }) => void;
            };
          };
        };
      };
    };
    if (w.google?.accounts?.oauth2) {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
      const client = w.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "email profile",
        callback: () => {},
      });
      return resolve(client);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
      if (!w.google?.accounts?.oauth2)
        return reject(new Error("GIS failed to load"));
      const client = w.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "email profile",
        callback: () => {},
      });
      resolve(client);
    };
    script.onerror = () => reject(new Error("Failed to load GIS script"));
    document.head.appendChild(script);
  });
}

/**
 * Trigger a browser file download.
 */
export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Format a byte count as a human-readable string.
 */
export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

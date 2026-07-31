"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Chrome,
  Download,
  Globe,
  KeyRound,
  Loader2,
  Puzzle,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { loadGoogleIdentity } from "@/lib/browser-utils";
import { useVault } from "@/store/vault";

const OAUTH_PROVIDERS = [
  { id: "google", label: "Google", icon: Chrome },
] as const;

export function AccountTab() {
  const oauthConnected = useVault((s) => s.oauthConnected);
  const oauthEmail = useVault((s) => s.oauthEmail);
  const connectOAuth = useVault((s) => s.connectOAuth);
  const disconnectOAuth = useVault((s) => s.disconnectOAuth);
  const cloudSyncing = useVault((s) => s.cloudSyncing);
  const cloudLastSync = useVault((s) => s.cloudLastSync);

  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] =
    React.useState(false);
  const [deleteCloudOnDisconnect, setDeleteCloudOnDisconnect] =
    React.useState(true);

  const GOOGLE_CLIENT_ID =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
      : "";

  const handleConnect = async () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error("Google OAuth not configured", {
        description:
          "Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local to enable cloud sync.",
      });
      return;
    }
    setConnecting(true);
    try {
      const tokenClient = await loadGoogleIdentity();
      tokenClient.requestAccessToken({
        prompt: "consent",
        callback: async (resp: {
          access_token: string;
          error?: string;
        }) => {
          if (resp.error || !resp.access_token) {
            setConnecting(false);
            toast.error("Google sign-in failed");
            return;
          }
          try {
            const exchangeRes = await fetch("/api/auth/exchange-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accessToken: resp.access_token }),
            });
            if (!exchangeRes.ok) throw new Error("Token exchange failed");
            const { idToken, email } = await exchangeRes.json();
            const result = await connectOAuth(idToken, email);
            if (result.exists) {
              toast.success("Connected to Google", {
                description:
                  "Cloud data found. Use 'Restore from cloud' to download it.",
              });
            } else {
              toast.success("Connected to Google", {
                description: "Your vault is ready to sync.",
              });
            }
          } catch {
            toast.error("Could not complete Google sign-in");
          }
          setConnecting(false);
        },
      });
    } catch {
      setConnecting(false);
      toast.error("Could not load Google Sign-In");
    }
  };

  const handleDisconnect = async () => {
    setShowDisconnectConfirm(false);
    setDisconnecting(true);
    try {
      await disconnectOAuth(deleteCloudOnDisconnect);
      toast.success(
        deleteCloudOnDisconnect
          ? "Disconnected and cloud data deleted"
          : "Disconnected",
      );
    } catch {
      toast.error("Could not disconnect. Make sure you are online.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Extension intro */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Puzzle className="h-4 w-4 text-primary" />
            Browser extension
          </h2>
          <p className="text-xs text-muted-foreground">
            Sign in once on every device. The LCKED extension brings your
            encrypted vault to every login form — autofill, generate, and
            audit, all without leaving the page.
          </p>
        </header>

        <ul className="grid gap-2 text-xs">
          {([
            { icon: KeyRound, text: "Autofill credentials on any website" },
            { icon: ShieldCheck, text: "On-page password generator" },
            { icon: AlertTriangle, text: "Weak / reused password audit" },
            { icon: Globe, text: "TOTP autofill for 2FA logins" },
          ] as const).map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-muted-foreground">
              <f.icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground/90">{f.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Google OAuth connect / connected */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-muted-foreground" />
            Cloud Sync
          </h2>
          <p className="text-xs text-muted-foreground">
            Connect your Google account to sync an encrypted backup of your
            vault. All data is encrypted locally before upload — the server
            never sees plaintext.
          </p>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {oauthConnected ? (
            <motion.div
              key="connected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    Connected as {oauthEmail}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {cloudLastSync
                      ? `Last synced: ${new Date(cloudLastSync).toLocaleString()}`
                      : "No sync yet — click 'Sync now' to upload your vault."}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-1.5 text-xs text-muted-foreground">
                  {cloudSyncing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>Syncing…</span>
                    </>
                  ) : cloudLastSync ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>
                        Auto-sync active · Last:{" "}
                        {new Date(cloudLastSync).toLocaleTimeString()}
                      </span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>
                        Auto-sync active · Changes sync automatically
                      </span>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-red-400 hover:text-red-500"
                  onClick={() => setShowDisconnectConfirm(true)}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  Disconnect
                </Button>
              </div>

              {showDisconnectConfirm && (
                <AlertDialog
                  open={showDisconnectConfirm}
                  onOpenChange={setShowDisconnectConfirm}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Disconnect Google account?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Choose what happens to your encrypted cloud backup.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 py-2">
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm">
                        <input
                          type="radio"
                          checked={deleteCloudOnDisconnect}
                          onChange={() =>
                            setDeleteCloudOnDisconnect(true)
                          }
                          className="mt-0.5 accent-primary"
                        />
                        <span>
                          <span className="font-medium">
                            Delete cloud data and disconnect
                          </span>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Permanently deletes your encrypted backup from
                            the cloud.
                          </span>
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm">
                        <input
                          type="radio"
                          checked={!deleteCloudOnDisconnect}
                          onChange={() =>
                            setDeleteCloudOnDisconnect(false)
                          }
                          className="mt-0.5 accent-primary"
                        />
                        <span>
                          <span className="font-medium">
                            Keep cloud data and disconnect
                          </span>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Your encrypted backup stays in the cloud but
                            will no longer sync.
                          </span>
                        </span>
                      </label>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className={
                          deleteCloudOnDisconnect
                            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            : ""
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          handleDisconnect();
                        }}
                      >
                        {deleteCloudOnDisconnect
                          ? "Delete & disconnect"
                          : "Disconnect"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="connect"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              {OAUTH_PROVIDERS.map((p) => {
                const Icon = p.icon;
                return (
                  <Button
                    key={p.id}
                    variant="outline"
                    className="h-11 w-full justify-center gap-2"
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    Continue with {p.label}
                  </Button>
                );
              })}
              {!GOOGLE_CLIENT_ID && (
                <p className="mt-2 text-center text-[10px] text-amber-500/70">
                  Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local to enable
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Install instructions */}
      <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4 text-xs">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Download className="h-4 w-4 text-muted-foreground" />
          Install the extension
        </div>
        <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
          <li>
            Open your browser&apos;s extension store (Chrome Web Store /
            Firefox Add-ons).
          </li>
          <li>
            Search for{" "}
            <span className="font-medium text-foreground">LCKED</span> and
            click Add to browser.
          </li>
          <li>
            Pin the extension, then sign in with the account above to enable
            autofill.
          </li>
        </ol>
      </div>
    </section>
  );
}

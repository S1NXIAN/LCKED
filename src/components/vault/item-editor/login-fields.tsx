"use client";

/**
 * LCKED — login field section: username + password, TOTP, website URLs,
 * notes. The URL rows use the stable per-row keys owned by the form hook
 * (IE-2) and a native <datalist> of every URL already in the vault.
 */

import { Globe, KeyRound, Lock, Mail, Plus, Trash2, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type LoginDetails, type VaultSettings } from "@/lib/types";
import { cn, isEmail } from "@/lib/utils";

import {
  FieldCluster,
  FieldClusterWithLabel,
  FieldRowInput,
  flatInputCls,
  flatPasswordInputCls,
  flatTextareaCls,
} from "../field-cluster";
import { PasswordField } from "../password-field";

export function LoginFields({
  details,
  settings,
  knownUrls,
  urlKeys,
  updateDetails,
  setUrl,
  addUrl,
  removeUrl,
}: {
  /** Login draft narrowed at the caller's `form.type === "login"` guard. */
  details: LoginDetails;
  settings: VaultSettings;
  /** Existing URLs across all non-trashed items — datalist autofill suggestions. */
  knownUrls: string[];
  urlKeys: string[];
  updateDetails: (patch: Partial<LoginDetails>) => void;
  setUrl: (idx: number, val: string) => void;
  addUrl: () => void;
  removeUrl: (idx: number) => void;
}) {
  const urls = details.urls;
  return (
    <div className="space-y-4">
      {/* Username + Password — the username label AND leading icon
                        switch between Mail / User based on whether the value looks
                        like an email. This mirrors the item-detail presentation. */}
      <FieldCluster>
        <FieldRowInput
          label={isEmail(details.username) ? "Email" : "Username"}
          icon={isEmail(details.username) ? Mail : User}
          first
        >
          <Input
            value={details.username}
            onChange={(e) => updateDetails({ username: e.target.value })}
            placeholder="you@example.com"
            autoComplete="off"
            className={flatInputCls}
          />
        </FieldRowInput>
        <FieldRowInput label="Password" icon={KeyRound}>
          <PasswordField
            value={details.password}
            onChange={(v) => updateDetails({ password: v })}
            placeholder="Enter password"
            showStrength
            showGenerate
            generatorOptions={settings.generator}
            inputClassName={flatPasswordInputCls}
          />
        </FieldRowInput>
      </FieldCluster>

      {/* TOTP */}
      <FieldClusterWithLabel label="Verification">
        <FieldRowInput icon={Lock} first>
          <Input
            value={details.totp}
            onChange={(e) => updateDetails({ totp: e.target.value })}
            placeholder="Base32 secret or otpauth:// URI"
            className={cn(flatInputCls, "font-secret")}
            autoComplete="off"
          />
        </FieldRowInput>
      </FieldClusterWithLabel>

      {/* URLs — wrapped in a labelled card cluster (Websites) with the
                        "Add URL" action in the header. Each URL row has a Globe icon
                        + Tab-to-autofill-https + a native <datalist> of every URL
                        already in the vault (trash excluded) for quick reuse. */}
      <FieldClusterWithLabel
        label="Websites"
        action={
          <Button type="button" variant="ghost" size="sm" onClick={addUrl}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add URL
          </Button>
        }
      >
        <datalist id="lcked-known-urls">
          {knownUrls.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        {urls.map((url, idx) => (
          <div
            key={urlKeys[idx] ?? idx}
            className={cn(
              "flex items-center gap-3 px-3.5 py-2.5",
              idx !== 0 && "border-border/50 border-t",
            )}
          >
            <Globe className="text-muted-foreground/70 h-4 w-4 shrink-0" />
            <Input
              value={url}
              onChange={(e) => setUrl(idx, e.target.value)}
              onKeyDown={(e) => {
                // Tab on an empty-ish website field auto-types
                // "https://" so the user doesn't have to. Only fires
                // when the field is empty or lacks a scheme — we then
                // insert the prefix and let the Tab proceed so focus
                // moves to the next field with the prefix already in
                // place. Shift+Tab (reverse) is left alone.
                if (e.key === "Tab" && !e.shiftKey) {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v && !/^[a-z]+:\/\//i.test(v)) {
                    e.preventDefault();
                    setUrl(idx, `https://${v}`);
                    // Move focus forward manually since we prevented Tab.
                    const inputs = e.currentTarget
                      .closest("form")
                      ?.querySelectorAll<HTMLElement>("input,textarea,button");
                    if (inputs) {
                      const arr = Array.from(inputs);
                      const cur = arr.indexOf(e.currentTarget);
                      const nextEl = arr[cur + 1];
                      nextEl?.focus();
                    }
                  }
                }
              }}
              list="lcked-known-urls"
              placeholder="example.com"
              className={cn(flatInputCls, "font-secret")}
              autoComplete="off"
            />
            {urls.length > 1 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-muted-foreground h-7 w-7 shrink-0 hover:text-signal-danger"
                onClick={() => removeUrl(idx)}
                aria-label={`Remove URL ${idx + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </FieldClusterWithLabel>

      {/* Notes */}
      <FieldClusterWithLabel label="Notes">
        <FieldRowInput first>
          <Textarea
            value={details.notes}
            onChange={(e) => updateDetails({ notes: e.target.value })}
            placeholder="Optional secure notes…"
            rows={3}
            className={flatTextareaCls}
          />
        </FieldRowInput>
      </FieldClusterWithLabel>
    </div>
  );
}

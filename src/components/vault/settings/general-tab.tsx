"use client";

import { Check, Eye, Globe, Palette } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";

export function GeneralTab() {
  const settings = useVault((s) => s.settings);
  const updateSettings = useVault((s) => s.updateSettings);
  const { theme: resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const themeId = mounted
    ? (resolvedTheme ?? "dark")
    : (typeof window !== "undefined" && window.localStorage.getItem("theme")) ||
      "dark";

  const handleSelectTheme = (id: string) => {
    setTheme(id);
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="text-muted-foreground h-4 w-4" />
          Appearance
        </h2>
        <p className="text-muted-foreground text-xs">
          Pick a colour scheme. Themes apply instantly and persist across
          sessions.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {THEMES.map((t) => {
          const active = themeId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleSelectTheme(t.id)}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border p-3 text-left transition duration-150",
                active
                  ? "border-primary bg-primary/5 ring-primary/30 ring-1"
                  : "border-border bg-muted/20 hover:border-border hover:bg-muted/40",
              )}
              aria-pressed={active}
            >
              <div className="flex -space-x-1.5 pt-0.5">
                {t.swatches.map((c, i) => (
                  <span
                    key={i}
                    className="border-background h-5 w-5 rounded-full border"
                    style={{ backgroundColor: c }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{t.label}</span>
                  {active && (
                    <Check
                      className="text-primary h-3.5 w-3.5"
                      aria-label="Active theme"
                    />
                  )}
                </div>
                <div className="text-muted-foreground text-[11px]">
                  {t.caption}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Separator />

      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Globe className="text-muted-foreground h-4 w-4" />
          List preferences
        </h2>
      </header>

      <div className="space-y-2">
        <label className="border-border bg-muted/20 flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-sm">Show website favicons</span>
            <span className="text-muted-foreground text-[11px]">
              Fetches website icons for login items. Disable for offline
              privacy.
            </span>
          </span>
          <Switch
            checked={settings.showFavicons}
            onCheckedChange={(v) => updateSettings({ showFavicons: v })}
          />
        </label>

        <label className="border-border bg-muted/20 flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-sm">Sort favorites to top</span>
            <span className="text-muted-foreground text-[11px]">
              Favorite items appear above others. Pinned items always stay at
              top regardless.
            </span>
          </span>
          <Switch
            checked={settings.sortFavoritesFirst}
            onCheckedChange={(v) => updateSettings({ sortFavoritesFirst: v })}
          />
        </label>

        <label className="border-border bg-muted/20 flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-sm">Show item actions on hover</span>
            <span className="text-muted-foreground text-[11px]">
              Item action buttons (restore/delete in trash) only appear when
              hovering. Disable to always show them.
            </span>
          </span>
          <Switch
            checked={settings.hoverItemActions}
            onCheckedChange={(v) => updateSettings({ hoverItemActions: v })}
          />
        </label>
      </div>

      <Separator />

      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="text-muted-foreground h-4 w-4" />
          Privacy
        </h2>
        <p className="text-muted-foreground text-xs">
          Blur email and username fields in the item list so shoulder-surfers
          can&rsquo;t read them.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { id: "off", label: "Off", caption: "Always visible" },
            {
              id: "hover",
              label: "On hover",
              caption: "Blurred, reveals on hover or selection",
            },
            {
              id: "full",
              label: "Full",
              caption: "Always blurred; hidden in details until revealed",
            },
          ] as const
        ).map((opt) => {
          const active = settings.blurEmailMode === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => updateSettings({ blurEmailMode: opt.id })}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition duration-150",
                active
                  ? "border-primary bg-primary/5 ring-primary/30 ring-1"
                  : "border-border bg-muted/20 hover:bg-muted/40",
              )}
              aria-pressed={active}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-muted-foreground text-[11px] leading-tight">
                {opt.caption}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

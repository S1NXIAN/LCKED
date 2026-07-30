"use client";

import * as React from "react";
import { Check, Eye, Globe, Palette } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";
import { useTheme } from "next-themes";

export function GeneralTab() {
  const settings = useVault((s) => s.settings);
  const updateSettings = useVault((s) => s.updateSettings);
  const { theme: resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const themeId = mounted
    ? resolvedTheme ?? "dark"
    : (typeof window !== "undefined" &&
        window.localStorage.getItem("theme")) || "dark";

  const handleSelectTheme = (id: string) => {
    setTheme(id);
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="h-4 w-4 text-muted-foreground" />
          Appearance
        </h2>
        <p className="text-xs text-muted-foreground">
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
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-muted/20 hover:border-border hover:bg-muted/40",
              )}
              aria-pressed={active}
            >
              <div className="flex -space-x-1.5 pt-0.5">
                {t.swatches.map((c, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border border-background"
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
                      className="h-3.5 w-3.5 text-primary"
                      aria-label="Active theme"
                    />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
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
          <Globe className="h-4 w-4 text-muted-foreground" />
          List preferences
        </h2>
      </header>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-sm">Show website favicons</span>
            <span className="text-[11px] text-muted-foreground">
              Fetches website icons for login items. Disable for offline
              privacy.
            </span>
          </span>
          <Switch
            checked={settings.showFavicons}
            onCheckedChange={(v) => updateSettings({ showFavicons: v })}
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-sm">Sort favorites to top</span>
            <span className="text-[11px] text-muted-foreground">
              Favorite items appear above others. Pinned items always stay at
              top regardless.
            </span>
          </span>
          <Switch
            checked={settings.sortFavoritesFirst}
            onCheckedChange={(v) => updateSettings({ sortFavoritesFirst: v })}
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-sm">Show item actions on hover</span>
            <span className="text-[11px] text-muted-foreground">
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
          <Eye className="h-4 w-4 text-muted-foreground" />
          Privacy
        </h2>
        <p className="text-xs text-muted-foreground">
          Blur email and username fields in the item list so shoulder-surfers
          can&rsquo;t read them.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {([
          { id: "off", label: "Off", caption: "Always visible" },
          {
            id: "hover",
            label: "On hover",
            caption:
              "Blurred, reveals on hover or selection",
          },
          {
            id: "full",
            label: "Full",
            caption:
              "Always blurred; hidden in details until revealed",
          },
        ] as const).map((opt) => {
          const active = settings.blurEmailMode === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => updateSettings({ blurEmailMode: opt.id })}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition duration-150",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-muted/20 hover:bg-muted/40",
              )}
              aria-pressed={active}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {opt.caption}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import * as React from "react";
import { Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const THEME_CYCLE: string[] = ["dark", "light", "nord", "proton"];

const THEME_LABELS: Record<string, string> = {
  dark: "Mocha",
  light: "Latte",
  nord: "Nord",
  proton: "Proton",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const currentTheme = theme ?? "dark";
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(currentTheme) + 1) % THEME_CYCLE.length];
  const label = mounted ? THEME_LABELS[currentTheme] ?? "Theme" : "Theme";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch theme (current: ${label})`}
      onClick={() => setTheme(nextTheme)}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
    >
      {mounted ? <Palette className="h-4 w-4" /> : null}
    </Button>
  );
}

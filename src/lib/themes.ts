export interface ThemeDef {
  id: string;
  label: string;
  caption: string;
  swatches: string[];
}

export const THEMES: ThemeDef[] = [
  { id: "dark", label: "Mocha", caption: "Catppuccin · dark", swatches: ["#1e1e2e", "#313244", "#cba6f7", "#fab387", "#a6e3a1"] },
  { id: "light", label: "Latte", caption: "Catppuccin · light", swatches: ["#eff1f5", "#e6e9ef", "#8839ef", "#fe640b", "#40a02b"] },
  { id: "nord", label: "Nord", caption: "Nord · arctic", swatches: ["#2e3440", "#3b4252", "#88c0d0", "#ebcb8b", "#a3be8c"] },
  { id: "proton", label: "Proton", caption: "Proton Pass · violet", swatches: ["#1f1f31", "#282839", "#302d45", "#7777f8", "#bfb9d8"] },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getThemeDef(id: string | undefined): ThemeDef | undefined {
  return THEMES.find((t) => t.id === id);
}

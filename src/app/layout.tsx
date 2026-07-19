import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/lcked/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LCKED — Local-first Password Manager",
  description:
    "LCKED is a zero-knowledge, local-first password manager. All encryption and storage happen entirely in your browser. Nothing plaintext ever leaves your device.",
  keywords: ["LCKED", "password manager", "local-first", "zero-knowledge", "encryption"],
  authors: [{ name: "LCKED" }],
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='f' x1='20' y1='8' x2='44' y2='56' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%23cba6f7' stop-opacity='0.95'/%3E%3Cstop offset='0.5' stop-color='%23cba6f7' stop-opacity='0.65'/%3E%3Cstop offset='1' stop-color='%23cba6f7' stop-opacity='0.45'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cg transform='rotate(45 32 32)'%3E%3Crect x='13' y='13' width='38' height='38' rx='5' fill='url(%23f)' stroke='%23cba6f7' stroke-opacity='0.5' stroke-width='1.5'/%3E%3C/g%3E%3Cg fill='%23cba6f7'%3E%3Ccircle cx='32' cy='27' r='4.5'/%3E%3Cpath d='M32 29.5 L29 42 L35 42 Z'/%3E%3C/g%3E%3Ccircle cx='32' cy='27' r='1.8' fill='black' fill-opacity='0.85'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1428",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
          themes={["dark", "light", "nord", "proton"]}
        >
          {children}
          <SonnerToaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

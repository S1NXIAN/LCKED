import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Single source of truth for the Content-Security-Policy (ADR-0003).
 *
 * Production: strict per-request nonce on `script-src` with
 * `'strict-dynamic'`, plus `'wasm-unsafe-eval'` so the lazily-loaded Argon2id
 * WASM module can compile — that directive licenses WebAssembly.instantiate
 * only, not script evaluation. Development relaxes `script-src` (hot reload
 * needs `'unsafe-eval'`) and drops `upgrade-insecure-requests` (the dev
 * server is plain HTTP); every other directive is identical in both modes.
 */
function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === "development";
  // Dev swaps the nonce/'strict-dynamic' pair for 'unsafe-inline' (host
  // allowlists are inert under strict-dynamic, and Next's inline bootstrap
  // scripts need an inline source) so the app and the impeccable live
  // picker both load in dev only.
  const scriptSrc = isDevelopment
    ? `'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' http://localhost:8400`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`;

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://icons.duckduckgo.com",
    `connect-src 'self'${isDevelopment ? " http://localhost:8400" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}

/**
 * Generates a fresh nonce per document request and attaches the CSP to both
 * the forwarded request (Next.js parses the nonce out of it and applies it to
 * its own bootstrap scripts) and the response seen by the browser.
 */
export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      // Document requests only: skip the real static-asset prefixes. Anything
      // else — including unmatched dotted paths like /nope.png, which render
      // an HTML 404 — must pass through so every document carries the CSP.
      source:
        "/((?!_next/static|_next/image|robots\\.txt|logo\\.svg|icons/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

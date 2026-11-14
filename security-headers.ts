/**
 * Security headers, defined once.
 *  - `vite preview` serves them, so the end-to-end tests run under the real policy.
 *  - The build writes them to dist/_headers, which Cloudflare Pages and Netlify apply in production.
 * The dev server does NOT use them (hot reload needs inline scripts).
 *
 * Privacy intent: the app may only talk to its own origin and to Supabase.
 * No third-party fonts, scripts, analytics or images. Camera is allowed for barcode scanning only.
 */
export const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    // The hash allows exactly one inline <style>: React Aria's usePress injects
    // #react-aria-pressable-style (touch-action for tap responsiveness and a Safari fix).
    // If a React Aria upgrade changes that text, the e2e CSP test fails and prints the new hash.
    "style-src 'self' 'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // Supabase (auth + encrypted sync). Narrow to your project URL once it exists.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "manifest-src 'self'",
    "worker-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy':
    'camera=(self), microphone=(), geolocation=(), payment=(), interest-cohort=()',
}

/** Format for a Cloudflare Pages / Netlify `_headers` file. */
export function toHeadersFile(headers: Record<string, string> = securityHeaders): string {
  const lines = Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`)
  return `/*\n${lines.join('\n')}\n`
}

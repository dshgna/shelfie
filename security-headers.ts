/**
 * Security headers, defined once.
 *  - scripts/serve-dist.mjs (`npm run preview`) serves them, so the end-to-end tests run under
 *    the real policy.
 *  - scripts/build-site.mjs writes them to dist/_headers, which statichost.eu applies in production.
 * The dev server does NOT use them (hot reload needs inline scripts).
 *
 * For now one statichost.eu site holds both the landing page (site/, served at /) and the app
 * (src/, served at /app/). Each gets its own set, and no URL may match more than one rule:
 * statichost.eu's handling of overlapping rules is unconfirmed, so nothing relies on rule order.
 * The landing page's rules name explicit paths and are never `/*`.
 *
 * Privacy intent (CLAUDE.md privacy rule 1): the app may only talk to its own origin and to
 * Supabase. The landing page may also contact exactly one analytics endpoint and one sign-up
 * service, once the owner has chosen them. No third-party fonts, scripts or images anywhere.
 * Camera is allowed in the app only, for barcode scanning.
 */

/** The app's headers, applied to /app/*. Do not loosen. */
export const appHeaders: Record<string, string> = {
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

/**
 * The landing page's two outside services, each one exact https origin or null while the owner
 * has not chosen it. When one changes, the pinned lists in src/security-headers.test.ts change
 * with it. Never guess one.
 *  - Analytics: not chosen yet.
 *  - Sign-up: the Supabase project that runs the `signup` edge function (owner, 16 Nov 2026).
 *    The landing page's forms post to `${SITE_SIGNUP_ORIGIN}${SIGNUP_FUNCTION_PATH}`, without
 *    JavaScript (form-action) or from site/site-assets/signup.js (connect-src).
 */
export const SITE_ANALYTICS_ORIGIN: string | null = null
export const SITE_SIGNUP_ORIGIN: string | null = 'https://ogyuvrcixtwbtjbuhljz.supabase.co'

/** Where the sign-up edge function lives on SITE_SIGNUP_ORIGIN. */
export const SIGNUP_FUNCTION_PATH = '/functions/v1/signup'

/** The outside origins the landing page may contact: only the ones that are set. */
const siteServices: (string | null)[] = [SITE_ANALYTICS_ORIGIN, SITE_SIGNUP_ORIGIN]
export const siteExtraOrigins: string[] = siteServices.filter(
  (origin): origin is string => origin !== null,
)

function sources(base: string, ...extra: (string | null)[]): string {
  return [base, ...extra.filter((origin): origin is string => origin !== null)].join(' ')
}

/**
 * The landing page's headers. No inline scripts or styles, no style="..." attributes, no data:
 * URLs: put CSS and images in files under site/site-assets/.
 */
export const siteHeaders: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    `connect-src ${sources("'self'", SITE_ANALYTICS_ORIGIN, SITE_SIGNUP_ORIGIN)}`,
    `form-action ${sources("'self'", SITE_SIGNUP_ORIGIN)}`,
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
}

/** The app is served under this path; vite.config.ts uses it as `base`. */
export const APP_BASE = '/app/'

/** The landing page's own asset folder (site/site-assets/ in the repo). */
export const SITE_ASSETS = '/site-assets/'

/** One `_headers` rule: a path line and the headers under it. */
export interface HeaderRule {
  path: string
  headers: Record<string, string>
}

/** The landing page's paths, listed one by one. Add a path here when site/ gets a new page. */
export const SITE_PATHS = ['/', '/index.html', '/privacy', `${SITE_ASSETS}*`]

/** Every rule in dist/_headers. No URL may match two of them (unit-tested). */
export const headerRules: HeaderRule[] = [
  { path: `${APP_BASE}*`, headers: appHeaders },
  ...SITE_PATHS.map((path) => ({ path, headers: siteHeaders })),
]

/** How a rule's path matches a URL path: a trailing `*` matches any rest, otherwise exact. */
export function pathMatches(pattern: string, pathname: string): boolean {
  return pattern.endsWith('*') ? pathname.startsWith(pattern.slice(0, -1)) : pathname === pattern
}

/** The rules that match a URL path; the unit tests require at most one. */
export function rulesFor(pathname: string): HeaderRule[] {
  return headerRules.filter((rule) => pathMatches(rule.path, pathname))
}

/**
 * Format for statichost.eu's `_headers` file (https://www.statichost.eu/docs/custom-headers/):
 * a path line, then each header indented four spaces.
 */
export function toHeadersFile(headers: Record<string, string>, path: string): string {
  const lines = Object.entries(headers).map(([k, v]) => `    ${k}: ${v}`)
  return `${path}\n${lines.join('\n')}\n`
}

/** The whole dist/_headers file: one block per rule, separated by a blank line. */
export function headersFile(): string {
  return headerRules.map((rule) => toHeadersFile(rule.headers, rule.path)).join('\n')
}

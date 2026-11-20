/**
 * The landing page waitlist sign-up: everything except the Deno entry point (index.ts), so
 * Vitest can test it. No Deno, Node or Supabase imports here: only web standards (Request,
 * Response, URL, URLSearchParams, TextDecoder) that both runtimes have.
 *
 * The landing page (site/index.html) has two sign-up forms. Each posts `email`, `website` (a
 * honeypot) and `form` (which form: 'hero' or 'end') as application/x-www-form-urlencoded. The
 * result always shows on the landing page itself, under the form that was used:
 *  - With JavaScript, site/site-assets/signup.js posts with fetch and `Accept: application/json`
 *    and gets `{"result": "..."}` back (CORS allows SITE_URL only), then shows the message inline.
 *  - Without JavaScript, the browser posts the form and gets a 303 back to
 *    `${SITE_URL}/#signup-<form>-<result>`, and the page's CSS shows that message (`:target`).
 *
 * The database function public.signup_add does the storing, deduplication and rate limiting.
 *
 * Privacy: never log an email address, a request body or a key. Responses carry no detail.
 */

/**
 * Stored with each sign-up, to record which wording the person agreed to.
 * Bump it (v2, v3, ...) whenever the wording on the sign-up form or on /privacy changes.
 */
export const NOTICE_VERSION = 'v1'

/** Bodies must be under 2 KB. */
export const MAX_BODY_BYTES = 2048

/** What public.signup_add returns. */
export type SignupResult = 'ok' | 'invalid' | 'rate_limited'

/** What the landing page is told: the database's answer, or 'error' when something failed. */
export type SignupOutcome = SignupResult | 'error'

/** Calls public.signup_add; index.ts passes the supabase-js version, tests a fake. */
export type SignupRpc = (email: string, notice: string) => Promise<SignupResult>

/** The landing page's sign-up forms, as sent in the `form` field. Anything else counts as 'hero'. */
export const SIGNUP_FORMS = ['hero', 'end'] as const
export type SignupForm = (typeof SIGNUP_FORMS)[number]

/** The id of the message the landing page shows, e.g. `signup-hero-ok`. */
export function messageId(form: SignupForm, outcome: SignupOutcome): string {
  return `signup-${form}-${outcome.replace('_', '-')}`
}

/** JSON status per outcome, for the script on the landing page. */
const JSON_STATUS: Record<SignupOutcome, number> = {
  ok: 200,
  invalid: 400,
  rate_limited: 429,
  error: 500,
}

const BASE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}

/** An empty response with the headers every response carries. */
export function emptyResponse(status: number, extra: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { ...BASE_HEADERS, ...extra } })
}

/**
 * SITE_URL must be exactly an https origin: scheme and host (and port, if any), no path, no
 * trailing slash, no query, no user info, written the way URL would write it. Anything else is
 * null, so a typo can never send people somewhere unexpected.
 */
export function parseSiteUrl(value: string | undefined): string | null {
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  return url.origin === value ? value : null
}

/** The address as stored: outer spaces trimmed, lower-cased. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/
const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const TOP_LEVEL = /^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/

/**
 * A practical check of a normalised address (ASCII only): one @, a local part of up to 64
 * characters without spaces or leading, trailing or double dots, and a domain of at least two
 * labels with a real-looking top level. At most 254 characters. The database checks again.
 */
export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false
  const at = email.lastIndexOf('@')
  if (at <= 0 || email.indexOf('@') !== at) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length > 64 || !LOCAL_PART.test(local)) return false
  const labels = domain.split('.')
  if (labels.length < 2 || !labels.every((label) => DOMAIN_LABEL.test(label))) return false
  return TOP_LEVEL.test(labels.at(-1) ?? '')
}

/** The form's fields; missing fields are empty strings, an unknown `form` is 'hero'. */
export function parseForm(body: string): { email: string; website: string; form: SignupForm } {
  const fields = new URLSearchParams(body)
  const form = fields.get('form')
  return {
    email: fields.get('email') ?? '',
    website: fields.get('website') ?? '',
    form: SIGNUP_FORMS.find((name) => name === form) ?? 'hero',
  }
}

/** True for application/x-www-form-urlencoded, with or without parameters such as charset. */
export function isFormContentType(value: string | null): boolean {
  return value?.split(';')[0]?.trim().toLowerCase() === 'application/x-www-form-urlencoded'
}

/** True when the landing page's script asked for JSON; a plain form post asks for HTML. */
export function wantsJson(accept: string | null): boolean {
  return (accept ?? '')
    .split(',')
    .some((type) => type.split(';')[0]?.trim().toLowerCase() === 'application/json')
}

/**
 * Reads at most `max - 1` bytes of a body as UTF-8. Returns null if the body is too big or is not
 * valid UTF-8; stops reading as soon as it is too big.
 */
export async function readBodyLimited(
  body: ReadableStream<Uint8Array> | null,
  max: number = MAX_BODY_BYTES,
): Promise<string | null> {
  if (body === null) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size >= max) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/** What public.signup_add returned, as an outcome. Anything unexpected is 'error'. */
export function outcomeFor(result: unknown): SignupOutcome {
  return result === 'ok' || result === 'invalid' || result === 'rate_limited' ? result : 'error'
}

/** Where the request came from and how it wants the answer. */
interface Reply {
  siteUrl: string
  json: boolean
  form: SignupForm
}

/** The answer for an outcome: JSON for the script, or a 303 back to the message on the page. */
export function respond({ siteUrl, json, form }: Reply, outcome: SignupOutcome): Response {
  const cors = { 'Access-Control-Allow-Origin': siteUrl, Vary: 'Origin, Accept' }
  if (json) {
    return new Response(JSON.stringify({ result: outcome }), {
      status: JSON_STATUS[outcome],
      headers: { ...BASE_HEADERS, ...cors, 'Content-Type': 'application/json' },
    })
  }
  return emptyResponse(303, { ...cors, Location: `${siteUrl}/#${messageId(form, outcome)}` })
}

export interface SignupEnv {
  /** SITE_URL from the function's environment: the landing page's origin. */
  siteUrl: string | undefined
  /** Calls public.signup_add, or null when the Supabase settings are missing. */
  rpc: SignupRpc | null
}

/**
 * The whole request flow. The order matters:
 *  1. SITE_URL must be valid, or 500 and nothing else happens (there is nowhere to send people).
 *  2. Only POST (405), only form-encoded (400), only bodies under 2 KB (400). No detail.
 *  3. A filled-in honeypot gets the same answer as a real sign-up, and nothing is stored.
 *  4. An address that fails the check is 'invalid' without calling the database.
 *  5. Otherwise signup_add decides. A repeated address returns 'ok' like a new one, so the
 *     response never shows who has signed up. A failed call is 'error'.
 */
export async function handleSignup(request: Request, env: SignupEnv): Promise<Response> {
  const siteUrl = parseSiteUrl(env.siteUrl)
  if (siteUrl === null) return emptyResponse(500)
  const cors = { 'Access-Control-Allow-Origin': siteUrl, Vary: 'Origin, Accept' }

  if (request.method !== 'POST') return emptyResponse(405, { ...cors, Allow: 'POST' })
  if (!isFormContentType(request.headers.get('content-type'))) return emptyResponse(400, cors)
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (!Number.isFinite(declared) || declared >= MAX_BODY_BYTES) return emptyResponse(400, cors)
  const body = await readBodyLimited(request.body)
  if (body === null) return emptyResponse(400, cors)

  const { email, website, form } = parseForm(body)
  const reply: Reply = { siteUrl, json: wantsJson(request.headers.get('accept')), form }
  if (website !== '') return respond(reply, 'ok')

  const normalised = normaliseEmail(email)
  if (!isValidEmail(normalised)) return respond(reply, 'invalid')

  if (env.rpc === null) return respond(reply, 'error')
  try {
    return respond(reply, outcomeFor(await env.rpc(normalised, NOTICE_VERSION)))
  } catch {
    return respond(reply, 'error')
  }
}

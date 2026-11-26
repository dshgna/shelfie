import { expect, type BrowserContext, type Page, type Route } from '@playwright/test'

// A fake Supabase Auth backend for e2e. The e2e build points the app at FAKE_SUPABASE_ORIGIN
// (playwright.config.ts sets VITE_SUPABASE_URL for the build), and every request to it is
// answered here or aborted: no test ever reaches a real Supabase project. Invented data only.

export const FAKE_SUPABASE_ORIGIN = 'https://e2e-fake.supabase.co'
export const FAKE_ANON_KEY = 'e2e-invented-anon-key'

export const TEST_EMAIL = 'person@example.test'
export const TEST_PASSWORD = 'Invented-Pass#2345'
/** The password the fake treats as wrong, for any address. */
export const WRONG_PASSWORD = 'not-the-right-one'

const USER_ID = '0b7e3c1a-1111-4aaa-8bbb-00000000e2e1'

export interface FakeSupabaseOptions {
  /** Sign-up answers without a session, as when Supabase asks for email confirmation. */
  confirmEmail?: boolean
}

export interface FakeCall {
  method: string
  path: string
  search: string
  body: Record<string, unknown> | null
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  // supabase-js reads the error code from `code` only when it can see this header.
  'access-control-expose-headers': 'x-supabase-api-version',
  'x-supabase-api-version': '2024-01-01',
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function user(email: string) {
  return {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-11-26T09:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: '2026-11-26T09:00:00Z',
    updated_at: '2026-11-26T09:00:00Z',
  }
}

function session(email: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const token = [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: USER_ID, email, aud: 'authenticated', role: 'authenticated', exp: expiresAt }),
    'invented-signature',
  ].join('.')
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: 'invented-refresh-token',
    user: user(email),
  }
}

/** The hash Supabase puts on the reset link's address, for a recovery session. */
export function recoveryHash(email = TEST_EMAIL): string {
  const s = session(email)
  return new URLSearchParams({
    access_token: s.access_token,
    expires_in: String(s.expires_in),
    expires_at: String(s.expires_at),
    refresh_token: s.refresh_token,
    token_type: 'bearer',
    type: 'recovery',
  }).toString()
}

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    headers: CORS,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

/** Answers every request to the fake project. Returns the calls it saw (never sent anywhere). */
export async function fakeSupabase(
  context: BrowserContext,
  options: FakeSupabaseOptions = {},
): Promise<FakeCall[]> {
  const calls: FakeCall[] = []
  await context.route(`${FAKE_SUPABASE_ORIGIN}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS })
      return
    }
    const body = (request.postDataJSON() as Record<string, unknown> | null) ?? null
    calls.push({ method, path: url.pathname, search: url.search, body })
    const email = typeof body?.email === 'string' ? body.email : TEST_EMAIL

    switch (`${method} ${url.pathname}`) {
      case 'POST /auth/v1/signup':
        return json(route, 200, options.confirmEmail ? user(email) : session(email))
      case 'POST /auth/v1/token':
        if (body?.password === WRONG_PASSWORD) {
          return json(route, 400, {
            code: 'invalid_credentials',
            message: 'Invalid login credentials',
          })
        }
        return json(route, 200, session(email))
      case 'POST /auth/v1/recover':
      case 'POST /auth/v1/resend':
        return json(route, 200, {})
      case 'GET /auth/v1/user':
      case 'PUT /auth/v1/user':
        return json(route, 200, user(email))
      case 'POST /auth/v1/logout':
        return route.fulfill({ status: 204, headers: CORS })
      default:
        return route.abort()
    }
  })
  return calls
}

/** Opens the app and signs in through the sign-in screen, with the fake backend. */
export async function openSignedIn(page: Page): Promise<FakeCall[]> {
  const calls = await fakeSupabase(page.context())
  await page.goto('/app/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const tab = page.getByRole('tab', { name: 'Sign in' })
  if (await tab.isVisible().catch(() => false)) await tab.click()
  else await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('tab', { name: /Inventory/ })).toBeVisible()
  return calls
}

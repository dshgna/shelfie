import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './guard'
import {
  FAKE_SUPABASE_ORIGIN,
  TEST_EMAIL,
  TEST_PASSWORD,
  WRONG_PASSWORD,
  fakeSupabase,
  openSignedIn,
  recoveryHash,
} from './fake-supabase'

// The sign-in screens end to end, at phone (390px) and web (1280px) widths, against the fake
// Supabase backend (no real network). guard.ts fails any test that asks another origin for
// anything, apart from the fake project, which is answered in the browser.

test.use({
  allowedOrigins: [FAKE_SUPABASE_ORIGIN],
  permissions: ['clipboard-read', 'clipboard-write'],
})

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`),
  ).toEqual([])
}

const shelves = (page: Page) => page.getByRole('tab', { name: /Inventory/ })

for (const width of [390, 1280]) {
  const wide = width >= 1024
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('signed out, any /app/ address shows Create account first', async ({ page }) => {
      await fakeSupabase(page.context())
      await page.goto('/app/somewhere/else')
      await expect(page).toHaveURL(/\/app\//)
      await page.goto('/app/')
      await expect(
        page.getByRole('heading', {
          name: wide ? 'Create Your Account' : 'Create your Shelfie account',
        }),
      ).toBeVisible()
      if (wide) {
        await expect(page.getByRole('tab', { name: 'Create account' })).toHaveAttribute(
          'aria-selected',
          'true',
        )
        await expect(page.getByText('Restock on time')).toBeVisible()
      }
      await expectNoAxeViolations(page)
    })

    test('create account: generate, copy, create, then the shelves', async ({ page }) => {
      const calls = await fakeSupabase(page.context())
      await page.goto('/app/')
      await page.getByLabel('Email').fill(TEST_EMAIL)
      await page.getByRole('button', { name: 'Generate password' }).click()
      const password = page.getByLabel('Password', { exact: true })
      await expect(password).toHaveAttribute('type', 'text')
      const generated = await password.inputValue()
      // The design's format with capitals and a symbol, e.g. Cobalt-Maple-River-Tulip-42!
      expect(generated).toMatch(/^[A-Z][a-z]+(-[A-Z][a-z]+){3}-[2-9]{2}[!#$%&*+=?@]$/)
      await page.getByRole('button', { name: 'Copy' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(generated)
      // Nothing typed ends up in the address.
      expect(page.url()).not.toContain('example.test')

      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(shelves(page)).toBeVisible()
      await expect(shelves(page)).toHaveAttribute('aria-selected', 'true')
      expect(calls.map((c) => `${c.method} ${c.path}`)).toContain('POST /auth/v1/signup')
      expect(page.url()).not.toContain('example.test')
    })

    test('create account with email confirmation shows Check your email', async ({ page }) => {
      await fakeSupabase(page.context(), { confirmEmail: true })
      await page.goto('/app/')
      await page.getByLabel('Email').fill(TEST_EMAIL)
      await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(
        page.getByRole('heading', { name: wide ? 'Check Your Email' : 'Check your email' }),
      ).toBeVisible()
      await expect(page.getByText(TEST_EMAIL)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Resend email' })).toBeDisabled()
      await expect(page.getByText(/You can send it again in \d+ s\./)).toBeVisible()
      await expectNoAxeViolations(page)
    })

    test('sign in: a wrong password gets the one message, then signing in opens the shelves', async ({
      page,
    }) => {
      await fakeSupabase(page.context())
      await page.goto('/app/')
      await page.getByRole('tab', { name: 'Sign in' }).click()
      await expect(
        page.getByRole('heading', { name: wide ? 'Welcome Back' : 'Sign in to Shelfie' }),
      ).toBeVisible()
      await expectNoAxeViolations(page)

      await page.getByLabel('Email').fill(TEST_EMAIL)
      await page.getByLabel('Password', { exact: true }).fill(WRONG_PASSWORD)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      const problem = page.getByText(
        "That email and password don't match. Check them and try again.",
      )
      await expect(problem).toBeVisible()
      await expect(problem).toBeFocused()

      await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(shelves(page)).toBeVisible()

      // Signed in, the sign-in screens never show, even after a reload.
      await page.reload()
      await expect(shelves(page)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0)
    })

    test('forgot password gives the same confirmation for any address', async ({ page }) => {
      const calls = await fakeSupabase(page.context())
      await page.goto('/app/')
      await page.getByRole('tab', { name: 'Sign in' }).click()
      await page.getByRole('button', { name: 'Forgot password?' }).click()
      await expect(
        page.getByRole('heading', { name: wide ? 'Forgot Your Password?' : 'Forgot password' }),
      ).toBeVisible()
      await expect(page.getByLabel('Email')).toBeFocused()
      await expectNoAxeViolations(page)

      await page.getByLabel('Email').fill('nobody@example.test')
      await page.getByRole('button', { name: 'Send reset link' }).click()
      await expect(
        page.getByText('If that address has an account, we have sent a link.'),
      ).toBeVisible()
      const recover = calls.find((c) => c.path === '/auth/v1/recover')
      expect(recover?.search).toContain(encodeURIComponent('/app/reset-password/'))
      await expectNoAxeViolations(page)
    })

    test('the reset link opens Reset password, which saves and opens the app', async ({ page }) => {
      const calls = await fakeSupabase(page.context())
      await page.goto(`/app/reset-password/#${recoveryHash()}`)
      await expect(
        page.getByRole('heading', { name: wide ? 'Reset Your Password' : 'Reset password' }),
      ).toBeVisible()
      await expectNoAxeViolations(page)
      await page.getByRole('button', { name: 'Generate password' }).click()
      await page.getByRole('button', { name: 'Save new password' }).click()
      await expect(shelves(page)).toBeVisible()
      await expect(page).toHaveURL(/\/app\/$/)
      const sent = calls.map(
        (c) => `${c.method} ${c.path}${c.path.endsWith('logout') ? c.search : ''}`,
      )
      expect(sent).toContain('PUT /auth/v1/user')
      expect(sent).toContain('POST /auth/v1/logout?scope=others')
    })
  })
}

test('the service worker caches nothing from Supabase', async ({ page }) => {
  await openSignedIn(page)
  await page.evaluate(async () => navigator.serviceWorker.ready)
  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url)
    }
    return urls
  })
  expect(cached.filter((url) => url.includes('supabase'))).toEqual([])
})

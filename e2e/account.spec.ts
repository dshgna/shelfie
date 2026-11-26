import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './guard'
import { FAKE_SUPABASE_ORIGIN, openSignedIn } from './fake-supabase'

// Account settings end to end at phone (390px) and web (1280px) widths, against the fake Supabase
// backend. guard.ts fails any request to another origin (the fake project is answered in the
// browser, never reached).

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

async function openAccount(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Account settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeFocused()
}

for (const width of [390, 1280]) {
  const wide = width >= 1024
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('opens Account settings, which passes axe and closes back to the shelves', async ({
      page,
    }) => {
      await openSignedIn(page)
      await openAccount(page)
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(
        wide
          ? ['Sign-In', 'Privacy', 'Devices', 'Your Data']
          : ['Sign-in', 'Privacy', 'Devices', 'Your data'],
      )
      await expectNoAxeViolations(page)
      await page.getByRole('button', { name: wide ? 'Close' : 'Back to shelves' }).click()
      await expect(page.getByRole('tab', { name: /Inventory/ })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Account menu' })).toBeFocused()
    })

    test('changes the password', async ({ page }) => {
      const calls = await openSignedIn(page)
      await openAccount(page)
      await page.getByRole('button', { name: 'Change password' }).click()
      await page.getByRole('button', { name: 'Generate password' }).click()
      await expectNoAxeViolations(page)
      await page.getByRole('button', { name: 'Save password' }).click()
      await expect(page.getByText('Password changed.')).toBeVisible()
      const update = calls.find((c) => c.method === 'PUT' && c.path === '/auth/v1/user')
      expect(typeof update?.body?.password).toBe('string')
      expect(update?.body).not.toHaveProperty('email')
    })

    test('signs out other devices after confirming', async ({ page }) => {
      const calls = await openSignedIn(page)
      await openAccount(page)
      await page.getByRole('button', { name: 'Sign out other devices' }).click()
      const dialog = page.getByRole('alertdialog', { name: 'Sign out other devices?' })
      await expect(dialog).toBeVisible()
      await expectNoAxeViolations(page)
      await dialog.getByRole('button', { name: 'Sign out other devices' }).click()
      await expect(page.getByText('Signed out of other devices')).toBeVisible()
      expect(calls.some((c) => c.path === '/auth/v1/logout' && c.search === '?scope=others')).toBe(
        true,
      )
      // Still signed in here.
      await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible()
    })

    test('signs out of this device and returns to Sign in', async ({ page }) => {
      const calls = await openSignedIn(page)
      if (wide) {
        await page.getByRole('button', { name: 'Account menu' }).click()
        await page.getByRole('menuitem', { name: 'Sign out' }).click()
      } else {
        await openAccount(page)
        await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      }
      await expect(
        page.getByRole('heading', { name: wide ? 'Welcome Back' : 'Sign in' }),
      ).toBeVisible()
      expect(calls.some((c) => c.path === '/auth/v1/logout' && c.search === '?scope=local')).toBe(
        true,
      )
      // The session is gone from this browser; the shelves' database stays on the device.
      const stored = await page.evaluate(() =>
        Object.keys(localStorage).filter((k) => k.endsWith('-auth-token')),
      )
      expect(stored).toEqual([])
      const databases = await page.evaluate(async () =>
        (await indexedDB.databases()).map((d) => d.name),
      )
      expect(databases.some((name) => name?.startsWith('shelfie-'))).toBe(true)
    })
  })
}

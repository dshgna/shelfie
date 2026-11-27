import { expect, test } from './guard'

// A build made without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the second web server in
// playwright.config.ts, on port 4174) must never be a blank page: it shows the plain "can't
// start" screen, with no uncaught error, and asks no other origin for anything (guard.ts).

test('a build without the Supabase settings shows the plain unavailable screen', async ({
  page,
}) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/app/')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: "Shelfie can't start right now. Please try again later.",
    }),
  ).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(pageErrors).toEqual([])
  // The owner sees which variable is missing in DevTools; the page itself shows no technical text.
  expect(consoleErrors.some((text) => text.includes('VITE_SUPABASE_URL'))).toBe(true)
  const shown = await page.locator('body').innerText()
  expect(shown).not.toMatch(/VITE_|supabase/i)
})

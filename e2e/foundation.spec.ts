import { expect, test } from '@playwright/test'

test('loads the shell and nothing leaves our origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:4173').origin
  const foreign: string[] = []
  const violations: string[] = []

  page.on('request', (req) => {
    const url = req.url()
    if (url.startsWith('data:') || url.startsWith('blob:')) return
    if (new URL(url).origin !== origin) foreign.push(url)
  })
  page.on('console', (msg) => {
    if (/content security policy/i.test(msg.text())) violations.push(msg.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Shelfie', level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(foreign, 'requests to other origins').toEqual([])
  expect(violations, 'CSP violations').toEqual([])
})

test('is installable: manifest is linked and valid', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const res = await request.get(href as string)
  expect(res.ok()).toBe(true)
  const manifest = await res.json()
  expect(manifest.name).toBe('Shelfie')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3)
})

test('theme button cycles system, light, dark', async ({ page }) => {
  await page.goto('/')
  const button = page.getByRole('button', { name: /Theme:/ })
  await expect(button).toHaveText('Theme: system')
  await button.click()
  await expect(button).toHaveText('Theme: light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await button.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await button.click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
})

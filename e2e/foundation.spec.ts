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

  await page.goto('/app/')
  await expect(page.getByRole('heading', { name: 'Shelfie', level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(foreign, 'requests to other origins').toEqual([])
  expect(violations, 'CSP violations').toEqual([])
})

test('is installable: manifest is linked and valid', async ({ page, request }) => {
  await page.goto('/app/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const res = await request.get(href as string)
  expect(res.ok()).toBe(true)
  const manifest = await res.json()
  expect(manifest.name).toBe('Shelfie')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3)
  expect(manifest.start_url).toBe('/app/')
  expect(manifest.scope).toBe('/app/')
  // Icons are relative to the manifest, so they must resolve under /app/.
  const manifestUrl = new URL(href as string, page.url())
  for (const icon of manifest.icons as { src: string }[]) {
    const iconUrl = new URL(icon.src, manifestUrl)
    expect(iconUrl.pathname, icon.src).toMatch(/^\/app\//)
    expect((await request.get(iconUrl.href)).ok(), icon.src).toBe(true)
  }
  for (const rel of ['icon', 'apple-touch-icon']) {
    const link = await page.locator(`link[rel="${rel}"]`).getAttribute('href')
    expect(link, rel).toMatch(/^\/app\//)
    expect((await request.get(link as string)).ok(), rel).toBe(true)
  }
})

test('the service worker only controls /app/', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:4173').origin
  await page.goto('/app/')
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(scope).toBe(`${origin}/app/`)

  await page.goto('/')
  const atRoot = await page.evaluate(async () => ({
    controlled: navigator.serviceWorker.controller !== null,
    registration: (await navigator.serviceWorker.getRegistration('/')) !== undefined,
  }))
  expect(atRoot).toEqual({ controlled: false, registration: false })
})

test('theme button cycles system, light, dark', async ({ page }) => {
  await page.goto('/app/')
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

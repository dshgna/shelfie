import { appHeaders, siteExtraOrigins, siteHeaders } from '../security-headers'
import { expect, test } from './guard'

// The landing page (site/, at /) and the app (/app/) share one site but have separate headers.
// The guard fails a test on any console CSP violation or any request to another origin, except
// the landing page's analytics and sign-up origins once they are set (none yet).
test.use({ allowedOrigins: siteExtraOrigins })

test('the landing page loads at / under its own policy, with one h1', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  expect(response?.headers()['content-security-policy']).toBe(
    siteHeaders['Content-Security-Policy'],
  )
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Stop keeping the bathroom cabinet in your head.',
  )
  await expect(page.getByRole('banner')).toHaveCount(1)
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('contentinfo')).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  // One script, our own: the local price line.
  await expect(page.locator('script')).toHaveCount(1)
  await expect(page.locator('script')).toHaveAttribute('src', '/site-assets/local-price.js')
  // Scroll through so lazy images load too; the guard then checks every request and CSP report.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForLoadState('networkidle')
})

test('every image and both bundled fonts load', async ({ page }) => {
  await page.goto('/')
  const images = page.locator('img')
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded()
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true)
  }
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      fredoka: document.fonts.check('600 20px Fredoka'),
      figtree: document.fonts.check('400 17px Figtree'),
      h1: getComputedStyle(document.querySelector('h1') as Element).fontFamily,
      body: getComputedStyle(document.body).fontFamily,
    }
  })
  expect(fonts.fredoka && fonts.figtree).toBe(true)
  expect(fonts.h1).toMatch(/^"?Fredoka/)
  expect(fonts.body).toMatch(/^"?Figtree/)
})

for (const width of [390, 1280]) {
  test(`fits ${width}px with no sideways scroll, and every target is at least 44px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
    const small = await page.locator('a, button, summary, input').evaluateAll((els) =>
      els
        .filter((el) => {
          const box = el.getBoundingClientRect()
          return box.width > 0 && (box.height < 44 || box.width < 44)
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    )
    expect(small).toEqual([])
  })
}

test('keyboard focus is visible', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  const focused = page.locator(':focus')
  await expect(focused).toHaveAttribute('aria-label', 'Shelfie home')
  const outline = await focused.evaluate((el) => {
    const style = getComputedStyle(el)
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
  })
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThanOrEqual(2)
})

test('respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const motion = await page.evaluate(() => ({
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    animations: document.getAnimations().length,
  }))
  expect(motion).toEqual({ scroll: 'auto', animations: 0 })
})

// The Plus price in the visitor's currency, worked out on the device from the browser language.
for (const [locale, expected] of [
  ['en-GB', null],
  ['en-US', 'about $4.04 a month'],
  ['en-IE', 'about €3.47 a month'],
] as const) {
  test.describe(`a visitor with ${locale}`, () => {
    test.use({ locale })

    test(expected ? `sees "${expected}" under Plus` : 'sees only the £ price', async ({ page }) => {
      await page.goto('/')
      const plus = page.getByRole('columnheader', { name: /Plus/ })
      await expect(plus).toContainText('£2.99 a month')
      const line = page.locator('#local-price')
      if (expected) await expect(line).toHaveText(expected)
      else await expect(line).toBeHidden()
    })
  })
}

test('the app loads under its own policy', async ({ page }) => {
  const response = await page.goto('/app/')
  expect(response?.headers()['content-security-policy']).toBe(appHeaders['Content-Security-Policy'])
  await expect(page.getByRole('button', { name: /Theme:/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
})

test('each path gets exactly one policy', async ({ request }) => {
  for (const [path, headers] of [
    ['/', siteHeaders],
    ['/index.html', siteHeaders],
    ['/app/', appHeaders],
    ['/app/sw.js', appHeaders],
    ['/app/manifest.webmanifest', appHeaders],
  ] as const) {
    const res = await request.get(path)
    expect(res.status(), path).toBe(200)
    expect(res.headers()['content-security-policy'], path).toBe(headers['Content-Security-Policy'])
    expect(res.headers()['permissions-policy'], path).toBe(headers['Permissions-Policy'])
  }
})

import type { Page, Route } from '@playwright/test'
import {
  SIGNUP_FUNCTION_PATH,
  SITE_ANALYTICS_ORIGIN,
  SITE_ANALYTICS_SCRIPT,
  SITE_SIGNUP_ORIGIN,
  appHeaders,
  siteExtraOrigins,
  siteHeaders,
} from '../security-headers'
import { expect, test } from './guard'

// The landing page (site/, at /) and the app (/app/) share one site but have separate headers.
// The guard fails a test on any console CSP violation or any request to another origin, except
// the landing page's own outside services (siteExtraOrigins: the sign-up function).
test.use({ allowedOrigins: siteExtraOrigins })

const SIGNUP_URL = `${SITE_SIGNUP_ORIGIN}${SIGNUP_FUNCTION_PATH}`

// Tests never reach the real Supabase project or Umami: every request to them is answered here
// (a test's own page.route wins) or aborted, so no test ever records a real sign-up or page view.
// Umami's tracker URL gets an empty stand-in script by default.
test.beforeEach(async ({ context }) => {
  await context.route(`${SITE_SIGNUP_ORIGIN}/**`, (route) => route.abort())
  await context.route(`${SITE_ANALYTICS_ORIGIN}/**`, (route) => route.abort())
  await context.route(`${SITE_ANALYTICS_SCRIPT}`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }),
  )
})

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
  // Four scripts: the local price line and the sign-up forms from our own origin, Umami's tracker
  // (answered by a stand-in here), and the section views, which need Umami loaded first.
  await expect(page.locator('script')).toHaveCount(4)
  expect(
    await page.locator('script').evaluateAll((els) => els.map((el) => el.getAttribute('src'))),
  ).toEqual([
    '/site-assets/local-price.js',
    '/site-assets/signup.js',
    'https://cloud.umami.is/script.js',
    '/site-assets/section-views.js',
  ])
  // Scroll through so lazy images load too; the guard then checks every request and CSP report.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForLoadState('networkidle')
})

test('Umami records the page view, through the CSP, and nothing else', async ({ page }) => {
  // Stand-ins for Umami's tracker and collector, so the real CSP is tested with no real page view:
  // the script loads from Umami's URL and posts like the tracker does.
  await page.route(`${SITE_ANALYTICS_SCRIPT}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `fetch('${SITE_ANALYTICS_ORIGIN}/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'event', payload: {
          website: document.currentScript.getAttribute('data-website-id'),
          url: location.href,
        } }),
      })`,
    }),
  )
  const sent: { type: string; payload: Record<string, unknown> }[] = []
  await page.route(`${SITE_ANALYTICS_ORIGIN}/api/send`, async (route) => {
    const request = route.request()
    const cors = {
      'Access-Control-Allow-Origin': new URL(page.url()).origin,
      'Access-Control-Allow-Headers': 'content-type',
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    sent.push(request.postDataJSON())
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: '{}',
    })
  })
  await page.goto('/')
  await expect.poll(() => sent.length).toBe(1)
  expect(sent[0]?.type).toBe('event')
  expect(sent[0]?.payload).toMatchObject({
    website: '112f1ebe-71fb-4b2e-bcf1-c3d03b4afb72',
    url: `${new URL(page.url()).origin}/`,
  })
  // The guard (CSP violations, unexpected origins) runs after the test as usual.
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
    // The honeypot (aria-hidden, out of the tab order) is not a target.
    const small = await page
      .locator('a, button, summary, input:not([type=hidden])')
      .evaluateAll((els) =>
        els
          .filter((el) => {
            const box = el.getBoundingClientRect()
            if (el.closest('[aria-hidden="true"]')) return false
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

// ---- Sign-up forms -------------------------------------------------------------------------
// Invented addresses on reserved domains only.

const MESSAGES = {
  ok: "You're on the list. We'll email you when Shelfie launches.",
  invalid: "That email address doesn't look right. Please check it and try again.",
  rate_limited: 'Lots of sign-ups right now. Please try again in a few minutes.',
  error: 'Something went wrong. Please try again later.',
} as const
type Outcome = keyof typeof MESSAGES

/** Answers like the edge function does for the page's script (JSON, CORS for this origin). */
async function answerJson(page: Page, result: Outcome, seen: string[] = []): Promise<void> {
  const status = { ok: 200, invalid: 400, rate_limited: 429, error: 500 }[result]
  await page.route(SIGNUP_URL, async (route: Route) => {
    const request = route.request()
    seen.push(`${request.headers()['accept']} | ${request.postData()}`)
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': new URL(page.url()).origin },
      body: JSON.stringify({ result }),
    })
  })
}

/** The sign-up box of one form: 'Register your interest' near the top, or at the end. */
function signup(page: Page, form: 'hero' | 'end') {
  const box = page.locator(`.signup--${form}`)
  return {
    box,
    email: box.getByLabel('Register your interest'),
    button: box.getByRole('button', { name: 'Notify me' }),
    status: box.locator('[data-signup-status][role="status"]'),
  }
}

test.describe('sign-up with JavaScript', () => {
  for (const result of Object.keys(MESSAGES) as Outcome[]) {
    test(`shows the ${result} message inline, under the form`, async ({ page }) => {
      const seen: string[] = []
      await answerJson(page, result, seen)
      await page.goto('/')
      const hero = signup(page, 'hero')
      await hero.email.fill('ana@example.com')
      await hero.button.click()
      await expect(hero.status).toHaveText(MESSAGES[result])
      await expect(page).toHaveURL(/\/$/)
      expect(seen).toEqual(['application/json | form=hero&email=ana%40example.com&website='])
      if (result === 'invalid') {
        await expect(hero.email).toHaveAttribute('aria-invalid', 'true')
        await expect(hero.email).toBeFocused()
      } else {
        await expect(hero.email).not.toHaveAttribute('aria-invalid')
      }
      await expect(hero.email).toHaveValue(result === 'ok' ? '' : 'ana@example.com')
      await expect(signup(page, 'end').status).toBeEmpty()
    })
  }

  test('the closing form answers under itself', async ({ page }) => {
    const seen: string[] = []
    await answerJson(page, 'ok', seen)
    await page.goto('/')
    const end = signup(page, 'end')
    await end.email.fill('bo@example.org')
    await end.button.click()
    await expect(end.status).toHaveText(MESSAGES.ok)
    await expect(signup(page, 'hero').status).toBeEmpty()
    expect(seen[0]).toContain('form=end&email=bo%40example.org')
  })

  test('a network failure shows the error message', async ({ page }) => {
    await page.route(SIGNUP_URL, (route) => route.abort('failed'))
    await page.goto('/')
    const hero = signup(page, 'hero')
    await hero.email.fill('ana@example.com')
    await hero.button.click()
    await expect(hero.status).toHaveText(MESSAGES.error)
  })

  test('an empty or malformed address never leaves the page', async ({ page }) => {
    const seen: string[] = []
    await answerJson(page, 'ok', seen)
    await page.goto('/')
    const hero = signup(page, 'hero')
    await hero.button.click()
    await hero.email.fill('not an address')
    await hero.button.click()
    await expect(hero.status).toBeEmpty()
    expect(seen).toEqual([])
  })

  test('the honeypot is out of reach: Tab goes from the address to the button', async ({
    page,
  }) => {
    await page.goto('/')
    const hero = signup(page, 'hero')
    await hero.email.focus()
    await page.keyboard.press('Tab')
    await expect(hero.button).toBeFocused()
    await expect(page.locator('#website-hero')).not.toBeInViewport()
  })

  test('the notice sits with each form, and no result shows before a sign-up', async ({ page }) => {
    await page.goto('/')
    for (const form of ['hero', 'end'] as const) {
      const { box, email } = signup(page, form)
      const notice = box.locator('.signup-notice')
      await expect(notice).toHaveText(
        "We'll only use your email to tell you when Shelfie launches, then delete it.",
      )
      await expect(notice.locator('a')).toHaveCount(0)
      await expect(email).toHaveAccessibleDescription(
        "We'll only use your email to tell you when Shelfie launches, then delete it.",
      )
      await expect(box.locator('.signup-result')).toHaveCount(4)
      for (const result of await box.locator('.signup-result').all()) {
        await expect(result).toBeHidden()
      }
    }
  })
})

// A stand-in for Umami's tracker: window.umami.track posts each event to the collector the way
// the real script does, so the tests see exactly what would leave the browser.
async function stubUmami(page: Page): Promise<string[]> {
  const bodies: string[] = []
  await page.route(`${SITE_ANALYTICS_SCRIPT}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `(() => {
        const website = document.currentScript.getAttribute('data-website-id')
        window.umami = {
          track: (name, data) =>
            fetch('${SITE_ANALYTICS_ORIGIN}/api/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'event', payload: { website, url: location.href, name, data } }),
            }),
        }
      })()`,
    }),
  )
  await page.route(`${SITE_ANALYTICS_ORIGIN}/api/send`, async (route) => {
    const request = route.request()
    const cors = {
      'Access-Control-Allow-Origin': new URL(page.url()).origin,
      'Access-Control-Allow-Headers': 'content-type',
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    bodies.push(request.postData() ?? '')
    return route.fulfill({
      status: 200,
      headers: cors,
      contentType: 'application/json',
      body: '{}',
    })
  })
  return bodies
}

/** The events sent so far, as `name` plus their data. */
function events(bodies: string[]) {
  return bodies.map((body) => {
    const { payload } = JSON.parse(body) as { payload: { name: string; data: unknown } }
    return { name: payload.name, data: payload.data }
  })
}

test.describe('Umami sign-up events', () => {
  // Only the sign-up events; section views are tested on their own below.
  const notify = (bodies: string[]) => events(bodies).filter((e) => e.name.startsWith('notify-'))

  async function signUp(page: Page, form: 'hero' | 'end', address = 'ana@example.com') {
    const box = signup(page, form)
    await box.email.fill(address)
    await box.button.click()
    await expect(box.status).not.toBeEmpty()
  }

  test('a sign-up sends notify-open, then notify-signup after the server says ok, and no address', async ({
    page,
  }) => {
    const bodies = await stubUmami(page)
    await answerJson(page, 'ok')
    await page.goto('/')
    await signUp(page, 'hero')
    await expect.poll(() => notify(bodies).length).toBe(2)
    expect(notify(bodies)).toEqual([
      { name: 'notify-open', data: { section: 'hero' } },
      { name: 'notify-signup', data: { section: 'hero' } },
    ])
    for (const body of bodies) expect(body).not.toContain('@')
  })

  test('the closing form reports section end', async ({ page }) => {
    const bodies = await stubUmami(page)
    await answerJson(page, 'ok')
    await page.goto('/')
    await signUp(page, 'end', 'bo@example.org')
    await expect.poll(() => notify(bodies).length).toBe(2)
    expect(notify(bodies).map((e) => e.data)).toEqual([{ section: 'end' }, { section: 'end' }])
  })

  for (const [result, reason] of [
    ['invalid', 'invalid'],
    ['rate_limited', 'rate_limited'],
    ['error', 'error'],
  ] as const) {
    test(`a ${result} answer sends notify-error with reason ${reason}`, async ({ page }) => {
      const bodies = await stubUmami(page)
      await answerJson(page, result)
      await page.goto('/')
      await signUp(page, 'hero')
      await expect.poll(() => notify(bodies).length).toBe(2)
      expect(notify(bodies)[1]).toEqual({
        name: 'notify-error',
        data: { section: 'hero', reason },
      })
      for (const body of bodies) expect(body).not.toContain('@')
    })
  }

  test('a network failure sends notify-error with reason network', async ({ page }) => {
    const bodies = await stubUmami(page)
    await page.route(SIGNUP_URL, (route) => route.abort('failed'))
    await page.goto('/')
    await signUp(page, 'hero')
    await expect.poll(() => notify(bodies).length).toBe(2)
    expect(notify(bodies)[1]).toEqual({
      name: 'notify-error',
      data: { section: 'hero', reason: 'network' },
    })
  })

  test('the same address twice counts as two sign-ups, like a new one', async ({ page }) => {
    const bodies = await stubUmami(page)
    await answerJson(page, 'ok')
    await page.goto('/')
    await signUp(page, 'hero')
    await signUp(page, 'hero')
    await expect.poll(() => notify(bodies).length).toBe(3)
    expect(notify(bodies).map((e) => e.name)).toEqual([
      'notify-open',
      'notify-signup',
      'notify-signup',
    ])
  })

  test('a filled-in honeypot sends no event at all', async ({ page }) => {
    const bodies = await stubUmami(page)
    const seen: string[] = []
    await answerJson(page, 'ok', seen)
    await page.goto('/')
    await page.locator('#website-hero').evaluate((input: HTMLInputElement) => {
      input.value = 'https://spam.example'
    })
    await signUp(page, 'hero', 'bot@example.com')
    expect(seen).toHaveLength(1)
    await page.waitForTimeout(500)
    expect(notify(bodies)).toEqual([])
  })

  test('the form still works when Umami is blocked', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.route(`${SITE_ANALYTICS_SCRIPT}`, (route) => route.abort('blockedbyclient'))
    await answerJson(page, 'ok')
    await page.goto('/')
    await signUp(page, 'hero')
    await expect(signup(page, 'hero').status).toHaveText(MESSAGES.ok)
    expect(errors).toEqual([])
  })
})

test.describe('Umami section views', () => {
  const VISIBLE = [
    'hero',
    'sound-familiar',
    'how-it-works',
    'every-cupboard',
    'greener-home',
    'privacy',
    'pricing',
    'faq',
    'closing',
  ]

  const sectionViews = (bodies: string[]) =>
    events(bodies)
      .filter((e) => e.name === 'section-view')
      .map((e) => e.data as Record<string, unknown>)

  for (const width of [390, 1440]) {
    test(`scrolling slowly at ${width}px counts each visible section once, in order`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const bodies = await stubUmami(page)
      await page.goto('/')
      await page.waitForTimeout(900)
      for (const name of VISIBLE.slice(1)) {
        await page
          .locator(`[data-section="${name}"]`)
          .evaluate((el) => el.scrollIntoView({ block: 'center' }))
        await page.waitForTimeout(900)
      }
      expect(sectionViews(bodies).map((data) => data.section)).toEqual(VISIBLE)
      // Only the section's name, nothing about the visitor or their scrolling.
      for (const data of sectionViews(bodies)) expect(Object.keys(data)).toEqual(['section'])
      for (const body of bodies) expect(body).not.toContain('@')
    })
  }

  for (const [link, target] of [
    ['How it works', 'how-it-works'],
    ['Privacy', 'privacy'],
    ['Pricing', 'pricing'],
    ['FAQ', 'faq'],
  ] as const) {
    test(`the ${link} link counts where it lands, not the sections it scrolls past`, async ({
      page,
    }) => {
      const bodies = await stubUmami(page)
      await page.goto('/')
      await page.waitForTimeout(900)
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: link }).click()
      // Long enough for the smooth scroll to land (slower on phones) and the 600 ms to pass.
      await page.waitForTimeout(3000)
      expect(sectionViews(bodies).map((data) => data.section)).toEqual(['hero', target])
    })
  }

  test('the hidden reviews placeholder never counts', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const bodies = await stubUmami(page)
    await page.goto('/')
    const reviews = page.locator('[data-section="reviews"]')
    await expect(reviews).toBeHidden()
    for (const name of ['privacy', 'pricing']) {
      await page
        .locator(`[data-section="${name}"]`)
        .evaluate((el) => el.scrollIntoView({ block: 'center' }))
      await page.waitForTimeout(900)
    }
    expect(sectionViews(bodies).map((data) => data.section)).not.toContain('reviews')
  })

  test('the page works the same when Umami is blocked', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.route(`${SITE_ANALYTICS_SCRIPT}`, (route) => route.abort('blockedbyclient'))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForTimeout(900)
    await page.locator('[data-section="closing"]').scrollIntoViewIfNeeded()
    await page.waitForTimeout(900)
    expect(errors).toEqual([])
  })
})

test.describe('sign-up without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  /** Answers like the edge function does for a plain form post: 303 back to the message. */
  async function answerRedirect(page: Page, id: string, seen: string[] = []): Promise<void> {
    await page.route(SIGNUP_URL, async (route) => {
      seen.push(route.request().postData() ?? '')
      await route.fulfill({
        status: 303,
        headers: { Location: `${new URL(page.url()).origin}/#${id}` },
      })
    })
  }

  for (const [form, result, id] of [
    ['hero', 'ok', 'signup-hero-ok'],
    ['hero', 'invalid', 'signup-hero-invalid'],
    ['end', 'rate_limited', 'signup-end-rate-limited'],
    ['end', 'error', 'signup-end-error'],
  ] as const) {
    test(`the ${form} form comes back to the ${result} message on the same page`, async ({
      page,
    }) => {
      const seen: string[] = []
      await answerRedirect(page, id, seen)
      await page.goto('/')
      const box = signup(page, form)
      await box.email.fill('ana@example.com')
      await box.button.click()
      await expect(page).toHaveURL(new RegExp(`/#${id}$`))
      await expect(page.locator(`#${id}`)).toBeVisible()
      await expect(page.locator(`#${id}`)).toHaveText(MESSAGES[result])
      await expect(page.locator(`#${id}`)).toBeInViewport()
      await expect(page.locator('.signup-result:visible')).toHaveCount(1)
      expect(seen).toEqual([`form=${form}&email=ana%40example.com&website=`])
    })
  }
})

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

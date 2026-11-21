import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SIGNUP_FUNCTION_PATH,
  SITE_ANALYTICS_SCRIPT,
  SITE_SIGNUP_ORIGIN,
} from '../security-headers'
import { SIGNUP_FORMS, messageId, type SignupOutcome } from '../supabase/functions/signup/logic'

/**
 * The landing page (site/) has no inline JavaScript, and loads scripts only from its own origin,
 * with one exception: Umami's tracker, by its exact URL (SITE_ANALYTICS_SCRIPT; CLAUDE.md privacy
 * rules 1 and 2), until it is self-hosted. The CSP enforces the same at runtime; this catches it
 * before a build. Pages are checked as text, so this also covers files the e2e tests don't open.
 */

/** The only scripts from another origin a page may load: exact URLs. */
const ALLOWED_FOREIGN_SCRIPTS = SITE_ANALYTICS_SCRIPT === null ? [] : [SITE_ANALYTICS_SCRIPT]

const siteRoot = new URL('../site/', import.meta.url)
const files = readdirSync(siteRoot, { recursive: true, encoding: 'utf8' })
  .map((f) => f.split('\\').join('/'))
  .filter((f) => /\.(html?|svg)$/i.test(f))
  .sort()

/** Problems with the scripts in one HTML or SVG text; `allowed` lists exact foreign URLs. */
export function scriptProblems(text: string, allowed: readonly string[] = []): string[] {
  const problems: string[] = []
  const source = text.replace(/<!--[\s\S]*?-->/g, '')
  const opened = source.match(/<script\b/gi)?.length ?? 0
  const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  if (scripts.length !== opened) problems.push('a <script> tag that is not closed')
  for (const [, attributes = '', body = ''] of scripts) {
    const src = /\ssrc\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1]
    if (src === undefined) {
      problems.push(`inline script: ${body.trim().slice(0, 60) || '(empty)'}`)
      continue
    }
    if (body.trim() !== '') problems.push(`script with src and inline code: ${src}`)
    // Same origin: a path ('/x.js', 'x.js'), never a scheme ('https:', 'data:') or '//host',
    // unless the exact URL is allowed.
    const foreign = /^([a-z][\w+.-]*:|\/\/|\\\\)/i.test(src.trim())
    if (foreign && !allowed.includes(src)) problems.push(`foreign script: ${src}`)
  }
  for (const [handler] of source.matchAll(/<[^>]*\son[a-z]+\s*=/gi)) {
    problems.push(`inline event handler: ${handler.slice(0, 60)}`)
  }
  if (/\b(href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(source)) {
    problems.push('javascript: URL')
  }
  return problems
}

describe('landing page scripts', () => {
  it('has pages to check', () => {
    expect(files).toContain('index.html')
  })

  it.each(files)('%s has no inline script and no other foreign script than Umami', (file) => {
    const text = readFileSync(new URL(file, siteRoot), 'utf8')
    expect(scriptProblems(text, ALLOWED_FOREIGN_SCRIPTS)).toEqual([])
  })

  it("allows exactly Umami Cloud's tracker URL, and only on the landing page", () => {
    expect(ALLOWED_FOREIGN_SCRIPTS).toEqual(['https://cloud.umami.is/script.js'])
    const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    expect(scriptProblems(app)).toEqual([])
    expect(app).not.toMatch(/umami/i)
  })

  it('catches each kind of script problem (the check itself)', () => {
    expect(scriptProblems('<script src="/site-assets/a.js"></script>')).toEqual([])
    expect(scriptProblems('<script src="site-assets/a.js" type="module"></script>')).toEqual([])
    expect(scriptProblems('<script>alert(1)</script>')).toHaveLength(1)
    expect(scriptProblems('<SCRIPT type="module">x()</SCRIPT>')).toHaveLength(1)
    expect(scriptProblems('<script src="https://cdn.example/a.js"></script>')).toHaveLength(1)
    expect(scriptProblems('<script src="//cdn.example/a.js"></script>')).toHaveLength(1)
    expect(scriptProblems('<script src="data:text/javascript,x()"></script>')).toHaveLength(1)
    expect(scriptProblems('<img src="a.png" onerror="x()">')).toHaveLength(1)
    expect(scriptProblems('<a href="javascript:x()">a</a>')).toHaveLength(1)
    expect(scriptProblems('<script src="/a.js">')).toHaveLength(1)
    expect(scriptProblems('<!-- <script>old()</script> -->')).toEqual([])
    const umami = ['https://cloud.umami.is/script.js']
    expect(
      scriptProblems('<script src="https://cloud.umami.is/script.js"></script>', umami),
    ).toEqual([])
    expect(
      scriptProblems('<script src="https://cloud.umami.is/other.js"></script>', umami),
    ).toHaveLength(1)
    expect(scriptProblems('<script src="https://cloud.umami.is/script.js"></script>')).toHaveLength(
      1,
    )
  })
})

describe('landing page sign-up forms', () => {
  const page = readFileSync(new URL('index.html', siteRoot), 'utf8')
  const forms = [...page.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)]
  const OUTCOMES: SignupOutcome[] = ['ok', 'invalid', 'rate_limited', 'error']

  it('has one form per sign-up form the function knows', () => {
    expect(forms).toHaveLength(SIGNUP_FORMS.length)
  })

  it('posts every form to the sign-up function on the CSP-allowed origin, and nowhere else', () => {
    expect(SITE_SIGNUP_ORIGIN).not.toBeNull()
    for (const [, attributes = ''] of forms) {
      expect(attributes).toContain(`action="${SITE_SIGNUP_ORIGIN}${SIGNUP_FUNCTION_PATH}"`)
      expect(attributes).toMatch(/method="post"/)
    }
    const actions = [...page.matchAll(/\b(?:action|formaction)\s*=\s*"([^"]*)"/gi)].map(
      ([, url]) => url,
    )
    expect(new Set(actions)).toEqual(new Set([`${SITE_SIGNUP_ORIGIN}${SIGNUP_FUNCTION_PATH}`]))
  })

  it.each(SIGNUP_FORMS)('the %s form sends its name, an email field and the honeypot', (name) => {
    const body = forms.find(([, , inner = '']) => inner.includes(`value="${name}"`))?.[2] ?? ''
    expect(body).toContain(`<input type="hidden" name="form" value="${name}" />`)
    expect(body).toMatch(/name="email"[\s\S]*type="email"[\s\S]*required/)
    expect(body).toMatch(/name="website"[^>]*tabindex="-1"/)
  })

  it.each(SIGNUP_FORMS)('has every message the function can send the %s form back to', (name) => {
    for (const outcome of OUTCOMES) {
      const id = messageId(name, outcome)
      expect(page, id).toMatch(
        new RegExp(`class="signup-result[^"]*"\\s+id="${id}"\\s+data-result="${outcome}"`),
      )
    }
  })
})

describe('Umami on the landing page', () => {
  it('loads Umami Cloud deferred, with the website id and no extra reporting', () => {
    const page = readFileSync(new URL('index.html', siteRoot), 'utf8')
    const tags = [...page.matchAll(/<script\b[^>]*umami[^>]*>/gi)].map(([tag]) => tag)
    expect(tags).toHaveLength(1)
    const tag = tags[0] ?? ''
    expect(tag).toMatch(/\sdefer\b/)
    expect(tag).toContain(`src="${SITE_ANALYTICS_SCRIPT}"`)
    expect(tag).toContain('data-website-id="112f1ebe-71fb-4b2e-bcf1-c3d03b4afb72"')
    expect(tag).not.toMatch(/data-(host-url|errors|performance)=/)
  })
})

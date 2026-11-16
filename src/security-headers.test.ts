import { describe, expect, it } from 'vitest'
import {
  APP_BASE,
  SITE_ANALYTICS_ORIGIN,
  SITE_SIGNUP_ORIGIN,
  appHeaders,
  headerRules,
  headersFile,
  rulesFor,
  siteExtraOrigins,
  siteHeaders,
  toHeadersFile,
} from '../security-headers'

/** A CSP as { directive: sources }. */
function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split('; ').map((d) => {
      const [name = '', ...values] = d.split(' ')
      return [name, values]
    }),
  )
}

const appCsp = appHeaders['Content-Security-Policy'] ?? ''
const siteCsp = siteHeaders['Content-Security-Policy'] ?? ''

describe('app security headers', () => {
  it('only allows our own origin and Supabase for network calls', () => {
    expect(directives(appCsp)['connect-src']).toEqual([
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
    ])
  })

  it('allows styles from our origin plus only the React Aria pressable style hash', () => {
    expect(directives(appCsp)['style-src']).toEqual([
      "'self'",
      "'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='",
    ])
  })

  it('keeps the whole strict policy exactly as it is', () => {
    expect(directives(appCsp)).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
      'manifest-src': ["'self'"],
      'worker-src': ["'self'"],
      'media-src': ["'self'", 'blob:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
    })
  })

  it('has no third-party sources for scripts, styles, fonts or images', () => {
    for (const name of ['script-src', 'style-src', 'font-src', 'img-src']) {
      const sources = (directives(appCsp)[name] ?? []).join(' ')
      expect(sources, name).not.toMatch(/https?:/)
      expect(sources, name).not.toContain("'unsafe-inline'")
      expect(sources, name).not.toContain("'unsafe-eval'")
    }
  })

  it('allows the camera for this origin only, and nothing else sensitive', () => {
    const policy = appHeaders['Permissions-Policy'] ?? ''
    expect(policy).toContain('camera=(self)')
    expect(policy).toContain('microphone=()')
    expect(policy).toContain('geolocation=()')
  })
})

describe('landing page security headers', () => {
  it('pins the exact policy, with both placeholders still empty', () => {
    expect(directives(siteCsp)).toEqual({
      'default-src': ["'none'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'"],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'form-action': ["'self'"],
      'base-uri': ["'none'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
    })
  })

  it('has no analytics or sign-up origin until the owner confirms the providers', () => {
    // When a provider is confirmed, set it in security-headers.ts and pin it here and above.
    expect(SITE_ANALYTICS_ORIGIN).toBeNull()
    expect(SITE_SIGNUP_ORIGIN).toBeNull()
    expect(siteExtraOrigins).toEqual([])
  })

  it('allows no inline code, no data: or blob: URLs and no other origins', () => {
    for (const source of siteCsp.split(/[ ;]+/)) {
      expect(source).not.toMatch(/unsafe-|^data:|^blob:|^https?:|^wss?:|\*/)
    }
  })

  it('allows no camera or other sensitive features', () => {
    const policy = siteHeaders['Permissions-Policy'] ?? ''
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(policy).toContain(`${feature}=()`)
    }
  })
})

/** Reads a statichost.eu _headers file back into blocks, independently of security-headers.ts. */
function parseHeadersFile(text: string): { path: string; headers: Record<string, string> }[] {
  const blocks: { path: string; headers: Record<string, string> }[] = []
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    if (!line.startsWith(' ')) {
      blocks.push({ path: line, headers: {} })
      continue
    }
    expect(line, 'header lines are indented four spaces').toMatch(/^ {4}\S/)
    const at = line.indexOf(': ')
    const block = blocks.at(-1)
    if (!block) throw new Error(`header before any path line: ${line}`)
    block.headers[line.slice(4, at)] = line.slice(at + 2)
  }
  return blocks
}

/** statichost.eu/Netlify-style matching: `*` matches anything, everything else is literal. */
function matches(pattern: string, pathname: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(pathname)
}

describe('dist/_headers', () => {
  const blocks = parseHeadersFile(headersFile())

  it('has one block per rule, the app first, and never a catch-all', () => {
    expect(blocks.map((b) => b.path)).toEqual([
      '/app/*',
      '/',
      '/index.html',
      '/privacy',
      '/site-assets/*',
    ])
    for (const { path } of blocks) expect(path).not.toMatch(/^\/?\*$/)
  })

  it.each([
    ['/', siteCsp],
    ['/index.html', siteCsp],
    ['/privacy', siteCsp],
    ['/site-assets/x.css', siteCsp],
    ['/app/', appCsp],
    ['/app/assets/x.js', appCsp],
    ['/app/sw.js', appCsp],
  ])('exactly one block matches %s, with the right CSP', (url, csp) => {
    const matching = blocks.filter((b) => matches(b.path, url))
    expect(matching).toHaveLength(1)
    expect(matching[0]?.headers['Content-Security-Policy']).toBe(csp)
    // The preview server picks the same single rule.
    expect(rulesFor(url).map((r) => r.path)).toEqual(matching.map((b) => b.path))
  })

  it('keeps every landing page rule out of /app/', () => {
    for (const rule of headerRules.filter((r) => r.headers === siteHeaders)) {
      expect(matches(rule.path, APP_BASE), rule.path).toBe(false)
      expect(rule.path.startsWith('/app'), rule.path).toBe(false)
    }
  })

  it('writes every header of each set under its path', () => {
    const app = blocks.find((b) => b.path === '/app/*')
    const landing = blocks.find((b) => b.path === '/')
    expect(app?.headers).toEqual(appHeaders)
    expect(landing?.headers).toEqual(siteHeaders)
  })

  it('indents every header four spaces under the path line', () => {
    expect(toHeadersFile({ 'X-One': 'a', 'X-Two': 'b c' }, '/x')).toBe(
      '/x\n    X-One: a\n    X-Two: b c\n',
    )
  })
})

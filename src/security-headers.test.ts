import { describe, expect, it } from 'vitest'
import { securityHeaders, toHeadersFile } from '../security-headers'

describe('security headers', () => {
  const csp = securityHeaders['Content-Security-Policy'] ?? ''

  it('only allows our own origin and Supabase for network calls', () => {
    const connect = csp.split('; ').find((d) => d.startsWith('connect-src')) ?? ''
    const allowed = connect.replace('connect-src ', '').split(' ')
    expect(allowed).toEqual(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'])
  })

  it('allows styles from our origin plus only the React Aria pressable style hash', () => {
    const style = csp.split('; ').find((d) => d.startsWith('style-src')) ?? ''
    const allowed = style.replace('style-src ', '').split(' ')
    expect(allowed).toEqual(["'self'", "'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='"])
  })

  it('has no third-party sources for scripts, styles, fonts or images', () => {
    for (const name of ['script-src', 'style-src', 'font-src', 'img-src']) {
      const directive = csp.split('; ').find((d) => d.startsWith(name)) ?? ''
      expect(directive, name).not.toMatch(/https?:/)
      expect(directive, name).not.toContain("'unsafe-inline'")
      expect(directive, name).not.toContain("'unsafe-eval'")
    }
  })

  it('blocks framing, plugins and base-tag hijacking', () => {
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
  })

  it('allows the camera for this origin only, and nothing else sensitive', () => {
    const policy = securityHeaders['Permissions-Policy'] ?? ''
    expect(policy).toContain('camera=(self)')
    expect(policy).toContain('microphone=()')
    expect(policy).toContain('geolocation=()')
  })

  it('renders a statichost.eu _headers file that applies to every path', () => {
    const file = toHeadersFile()
    expect(file.startsWith('*\n')).toBe(true)
    expect(file).toContain('Content-Security-Policy:')
  })

  it('indents every header four spaces under the path line', () => {
    const file = toHeadersFile({ 'X-One': 'a', 'X-Two': 'b c' })
    expect(file).toBe('*\n    X-One: a\n    X-Two: b c\n')
  })
})

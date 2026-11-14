import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * src/styles.css must match design/tokens.json, which mirrors the owner's design doc.
 * If this fails after a design change, update design/tokens.json first (only when the owner
 * says the design changed), then styles.css. Never edit the tokens to make this pass.
 */

type Tokens = {
  fonts: { display: string; body: string }
  light: Record<string, string>
  dark: Record<string, string>
}

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8')
const tokens = JSON.parse(read('../design/tokens.json')) as Tokens
const css = read('./styles.css').replace(/\/\*[\s\S]*?\*\//g, '')

/** Files outside styles.css that carry colours: the app shell, the favicon and the PWA manifest. */
const COLOUR_FILES = ['../index.html', '../public/favicon.svg', '../vite.config.ts']

const SELECTORS = {
  light: ':root',
  systemDark: ":root:not([data-theme='light'])",
  forcedDark: ":root[data-theme='dark']",
}

function blockBody(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`styles.css has no "${selector} {" block`)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  throw new Error(`styles.css block "${selector}" is not closed`)
}

const normalise = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase()

function customProperties(selector: string): Record<string, string> {
  const props: Record<string, string> = {}
  for (const [, name, value] of blockBody(selector).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (name && value) props[name] = normalise(value)
  }
  return props
}

function normaliseAll(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, normalise(v)]))
}

/** Hex colours in a text, lower-cased and expanded to six digits (#fff -> #ffffff). */
function hexColours(text: string): string[] {
  return [...text.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)].map(([, hex = '']) => {
    const lower = hex.toLowerCase()
    return `#${lower.length === 3 ? [...lower].map((c) => c + c).join('') : lower}`
  })
}

describe('design tokens', () => {
  const light = customProperties(SELECTORS.light)
  const systemDark = customProperties(SELECTORS.systemDark)
  const forcedDark = customProperties(SELECTORS.forcedDark)

  it('light theme matches design/tokens.json exactly', () => {
    expect(light).toEqual(normaliseAll(tokens.light))
  })

  it('dark theme matches design/tokens.json exactly', () => {
    expect(forcedDark).toEqual(normaliseAll(tokens.dark))
  })

  it('system dark and forced dark blocks are identical', () => {
    expect(systemDark).toEqual(forcedDark)
  })

  it('dark tokens only override tokens that exist in light', () => {
    const lightNames = Object.keys(tokens.light)
    expect(Object.keys(tokens.dark).filter((name) => !lightNames.includes(name))).toEqual([])
  })

  it('uses no colour literals outside the design doc palette', () => {
    const palette = new Set(
      [...Object.values(tokens.light), ...Object.values(tokens.dark)].flatMap(hexColours),
    )
    const sources = {
      'src/styles.css': css,
      ...Object.fromEntries(COLOUR_FILES.map((f) => [f, read(f)])),
    }
    for (const [file, text] of Object.entries(sources)) {
      expect(
        hexColours(text).filter((c) => !palette.has(c)),
        file,
      ).toEqual([])
      expect(text, `${file} uses rgb()/hsl()`).not.toMatch(/\b(rgba?|hsla?)\(/)
    }
  })

  it('uses only the design fonts, bundled from @fontsource-variable', () => {
    const theme = customProperties('@theme inline')
    for (const [role, family] of Object.entries(tokens.fonts)) {
      const firstFamily = (theme[`--font-${role}`] ?? '').split(',')[0]?.replace(/['"]/g, '')
      expect(firstFamily, `--font-${role}`).toBe(`${family} variable`.toLowerCase())
      expect(css).toContain(`@import '@fontsource-variable/${family.toLowerCase()}';`)
    }
    const fontImports = [...css.matchAll(/@import '@fontsource[^']*'/g)].map(([m]) => m)
    expect(fontImports).toHaveLength(Object.keys(tokens.fonts).length)
  })
})

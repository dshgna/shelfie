import { readFileSync, readdirSync } from 'node:fs'
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

// ---------------------------------------------------------------------------------------------
// The landing page (site/) uses the same palette and fonts. Its CSS and HTML are checked more
// strictly than the files above: hex in any length (#rgb, #rgba, #rrggbb, #rrggbbaa; the alpha
// is ignored, the colour must be in the palette), CSS colour functions other than color-mix, and
// named colours. Tints are color-mix() of palette colours. No exception list.

const siteRoot = new URL('../site/', import.meta.url)
const siteFiles = (extensions: string[]): string[] =>
  readdirSync(siteRoot, { recursive: true, encoding: 'utf8' })
    .map((f) => f.split('\\').join('/'))
    .filter((f) => extensions.some((ext) => f.endsWith(ext)))
    .sort()
const readSite = (file: string): string => readFileSync(new URL(file, siteRoot), 'utf8')

/** Every hex literal, as its six-digit colour (alpha dropped); malformed lengths come back as-is. */
function anyHexColours(text: string): string[] {
  return [...text.matchAll(/#([0-9a-f]{3,8})\b/gi)].map(([, hex = '']) => {
    const h = hex.toLowerCase()
    if (h.length === 3 || h.length === 4) return `#${[...h.slice(0, 3)].map((c) => c + c).join('')}`
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`
    return `#${h}`
  })
}

const COLOUR_FUNCTIONS = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i

// CSS named colours (CSS Color 4), other than transparent and currentColor.
const NAMED_COLOURS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
    'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
    'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
    'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
    'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
    'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
    'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
    'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
    'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
    'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
)

/** Named colours used as values (strings, url() and font names are not values). */
function namedColours(value: string): string[] {
  const bare = value.replace(/url\([^)]*\)/gi, '').replace(/(['"]).*?\1/g, '')
  return (bare.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => NAMED_COLOURS.has(w))
}

/** `property: value` pairs of a stylesheet, comments and @font-face blocks left out. */
function cssDeclarations(text: string): [string, string][] {
  const body = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '')
  return [...body.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)].map(([, p = '', v = '']) => [p, v])
}

/** Attribute values in HTML tags, minus attributes that hold names, links or text, not colours. */
const NON_COLOUR_ATTRIBUTES =
  /^(href|src|id|for|class|alt|title|content|name|rel|type|as|lang|d|viewbox|aria-[\w-]+)$/i
function htmlAttributeValues(text: string): string[] {
  const values: string[] = []
  for (const [tag] of text.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<[a-z][^>]*>/gi)) {
    for (const [, name = '', value = ''] of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
      if (!NON_COLOUR_ATTRIBUTES.test(name)) values.push(value)
    }
  }
  return values
}

describe('landing page (site/) design rules', () => {
  const palette = new Set(
    [...Object.values(tokens.light), ...Object.values(tokens.dark)].flatMap(hexColours),
  )
  const cssFiles = siteFiles(['.css'])
  const htmlFiles = siteFiles(['.html'])

  it('has a stylesheet and a page to check', () => {
    expect(cssFiles.length).toBeGreaterThan(0)
    expect(htmlFiles).toContain('index.html')
  })

  it('uses only palette colours and their tints in site/**/*.css', () => {
    for (const file of cssFiles) {
      const text = readSite(file).replace(/\/\*[\s\S]*?\*\//g, '')
      expect(
        anyHexColours(text).filter((c) => !palette.has(c)),
        file,
      ).toEqual([])
      expect(text, `${file} uses a colour function other than color-mix`).not.toMatch(
        COLOUR_FUNCTIONS,
      )
      const named = cssDeclarations(text)
        .filter(([property]) => !/^(font-family|src|unicode-range|content)$/.test(property))
        .flatMap(([property, value]) => namedColours(value).map((c) => `${property}: ${c}`))
      expect(named, `${file} uses named colours`).toEqual([])
    }
  })

  it('uses only palette colours in site/**/*.html, and no inline styles', () => {
    for (const file of htmlFiles) {
      const text = readSite(file)
      expect(text, `${file} has a style attribute`).not.toMatch(/\sstyle\s*=/i)
      expect(text, `${file} has a <style> element`).not.toMatch(/<style\b/i)
      const values = htmlAttributeValues(text)
      expect(
        values.flatMap(anyHexColours).filter((c) => !palette.has(c)),
        file,
      ).toEqual([])
      expect(values.join(' '), `${file} uses a colour function`).not.toMatch(COLOUR_FUNCTIONS)
      expect(values.flatMap(namedColours), `${file} uses named colours`).toEqual([])
    }
  })

  it('catches every form of colour literal (the checks themselves)', () => {
    expect(anyHexColours('#FFF #15262a1f #eef4f1 #abcd #12345')).toEqual([
      '#ffffff',
      '#15262a',
      '#eef4f1',
      '#aabbcc',
      '#12345',
    ])
    expect('box-shadow: 0 0 1px rgba(0,0,0,.1)').toMatch(COLOUR_FUNCTIONS)
    expect('color: color(display-p3 1 0 0)').toMatch(COLOUR_FUNCTIONS)
    expect('background: color-mix(in srgb, #82b5a3 20%, #fff)').not.toMatch(COLOUR_FUNCTIONS)
    expect(namedColours("1px solid white, url('red.svg') 'Teal Sans'")).toEqual(['white'])
    expect(htmlAttributeValues('<a href="#bad" fill="#c0ffee">')).toEqual(['#c0ffee'])
  })

  it('uses only the design fonts, as bundled copies of the @fontsource-variable files', () => {
    const families = new Set(Object.values(tokens.fonts))
    for (const file of cssFiles) {
      const text = readSite(file).replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [property, value] of cssDeclarations(text)) {
        if (property !== 'font-family' && !/^--font-/.test(property)) continue
        if (value.trim().startsWith('var(') || /^(inherit|initial)$/.test(value.trim())) continue
        const first = value.split(',')[0]?.trim().replace(/['"]/g, '') ?? ''
        expect(families.has(first), `${file} ${property}: ${value}`).toBe(true)
      }
      for (const [, url = ''] of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        expect(url, `${file} loads ${url}`).not.toMatch(/^([a-z][\w+.-]*:|\/\/)/i)
      }
    }
    const fonts = siteFiles(['.woff2'])
    expect(fonts.length).toBeGreaterThan(0)
    for (const font of fonts) {
      const name = font.split('/').at(-1) ?? ''
      const family = name.split('-')[0] ?? ''
      expect(families.has(family.charAt(0).toUpperCase() + family.slice(1)), font).toBe(true)
      const original = readFileSync(
        new URL(`../node_modules/@fontsource-variable/${family}/files/${name}`, import.meta.url),
      )
      expect(readFileSync(new URL(font, siteRoot)).equals(original), font).toBe(true)
    }
  })
})

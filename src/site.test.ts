import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The landing page (site/) has no JavaScript for now, and may never load a script from another
 * origin (CLAUDE.md privacy rules 1 and 2). The CSP blocks both at runtime; this catches them
 * before a build. Pages are checked as text, so this also covers files the e2e tests don't open.
 */

const siteRoot = new URL('../site/', import.meta.url)
const files = readdirSync(siteRoot, { recursive: true, encoding: 'utf8' })
  .map((f) => f.split('\\').join('/'))
  .filter((f) => /\.(html?|svg)$/i.test(f))
  .sort()

/** Problems with the scripts in one HTML or SVG text. */
export function scriptProblems(text: string): string[] {
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
    // Same origin only: a path ('/x.js', 'x.js'), never a scheme ('https:', 'data:') or '//host'.
    if (/^([a-z][\w+.-]*:|\/\/|\\\\)/i.test(src.trim())) problems.push(`foreign script: ${src}`)
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

  it.each(files)('%s has no inline script and no script from another origin', (file) => {
    expect(scriptProblems(readFileSync(new URL(file, siteRoot), 'utf8'))).toEqual([])
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
  })
})

// Runs the native build (`vite build --mode native`) and checks what Capacitor will serve from
// dist/native: relative asset paths, and no service worker, registerSW.js or manifest. The
// Supabase variables are set empty for this build, so it never contains real project values.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))
const out = join(root, 'dist', 'native')

let html = ''

beforeAll(() => {
  execFileSync(join(root, 'node_modules', '.bin', 'vite'), ['build', '--mode', 'native'], {
    cwd: root,
    env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    stdio: 'pipe',
  })
  html = readFileSync(join(out, 'index.html'), 'utf8')
}, 120_000)

describe('the native build (dist/native)', () => {
  it('uses ./ for every asset in index.html', () => {
    const urls = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map(([, url]) => url ?? '')
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) expect(url, url).toMatch(/^\.\//)
    expect(html).not.toContain('/app/')
  })

  it('loads fonts and other CSS assets relative to the stylesheet', () => {
    const assets = join(out, 'assets')
    const css = readdirSync(assets).filter((name) => name.endsWith('.css'))
    expect(css.length).toBeGreaterThan(0)
    for (const file of css) {
      for (const [, url = ''] of readFileSync(join(assets, file), 'utf8').matchAll(
        /url\(([^)]*)\)/g,
      )) {
        if (url.startsWith('data:')) continue
        expect(url, url).toMatch(/^\.\//)
      }
    }
  })

  it('has no service worker, registerSW.js or manifest', () => {
    for (const file of ['sw.js', 'registerSW.js', 'manifest.webmanifest']) {
      expect(existsSync(join(out, file)), file).toBe(false)
    }
    expect(readdirSync(out).filter((name) => /^workbox-|\.webmanifest$/.test(name))).toEqual([])
    expect(html).not.toMatch(/registerSW|manifest|serviceWorker/)
  })

  it('has every file index.html points to', () => {
    for (const [, url = ''] of html.matchAll(/\s(?:src|href)="\.\/([^"]+)"/g)) {
      expect(existsSync(join(out, url)), url).toBe(true)
    }
  })
})

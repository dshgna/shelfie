// Fills the root of dist/ around the app build (dist/app, written by `vite build`):
//  0. copies dist/app/index.html to dist/app/reset-password/index.html, so the password reset
//     link (/app/reset-password/) opens the app on any static host without a rewrite rule,
//  1. removes anything else left in dist/ by an earlier build (dist/app is kept),
//  2. copies site/ (the landing page) into dist/,
//  3. writes dist/_headers for statichost.eu from security-headers.ts, after checking that every
//     file from site/ is covered by exactly one landing-page rule (none would mean no headers).
// One statichost.eu site for now: landing at /, app at /app/. See docs/decisions.md.
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'
import { headersFile, rulesFor, siteHeaders } from '../security-headers.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const site = join(root, 'site')
const APP_DIR = 'app'

const appBuilt = await stat(join(dist, APP_DIR, 'index.html')).then(
  () => true,
  () => false,
)
if (!appBuilt) {
  console.error('dist/app/index.html is missing: run `vite build` first.')
  process.exit(1)
}

// The reset link's address (RESET_PASSWORD_PATH in src/auth/service.ts) serves the app too.
await mkdir(join(dist, APP_DIR, 'reset-password'), { recursive: true })
await cp(join(dist, APP_DIR, 'index.html'), join(dist, APP_DIR, 'reset-password', 'index.html'))

for (const name of await readdir(dist)) {
  if (name !== APP_DIR) await rm(join(dist, name), { recursive: true, force: true })
}

for (const name of await readdir(site)) {
  if (name === APP_DIR || name === '_headers') {
    console.error(`site/${name} would clash with the app build or the headers file.`)
    process.exit(1)
  }
  await cp(join(site, name), join(dist, name), { recursive: true })
}

// URL paths of the copied site files (a folder's index.html is also served at the folder).
const sitePaths = (await readdir(site, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .flatMap((entry) => {
    const path = `/${relative(site, join(entry.parentPath, entry.name)).split(sep).join('/')}`
    return path.endsWith('/index.html') ? [path, path.slice(0, -'index.html'.length)] : [path]
  })
const uncovered = sitePaths.filter((path) => {
  const rules = rulesFor(path)
  return rules.length !== 1 || rules[0]?.headers !== siteHeaders
})
if (uncovered.length > 0) {
  console.error(
    `No single landing-page _headers rule covers: ${uncovered.join(', ')}. Add them to SITE_PATHS in security-headers.ts.`,
  )
  process.exit(1)
}

await writeFile(join(dist, '_headers'), headersFile())
console.log(
  'dist/: copied site/, wrote _headers (app headers on /app/*, site headers on the landing paths)',
)

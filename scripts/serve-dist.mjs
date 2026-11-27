// Serves the whole dist/ folder (landing page at /, app at /app/) on localhost:4173, the way
// statichost.eu does, with the headers from the same rules that make dist/_headers
// (security-headers.ts): the app's on /app/*, the landing page's on its listed paths. A URL that
// matches two rules is a 500, so an overlap shows up in the e2e tests. Used by `npm run preview`
// and the Playwright tests. `vite preview` can only serve the app's own output folder, hence this
// script. It is a local test server, not for production.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rulesFor } from '../security-headers.ts'

// PREVIEW_DIR and PREVIEW_PORT let the e2e tests serve a second build (one made without the
// Supabase settings, e2e/unconfigured.spec.ts) beside the main one.
const PORT = Number(process.env.PREVIEW_PORT ?? 4173)
const HOST = 'localhost'
const dist = process.env.PREVIEW_DIR
  ? resolve(process.env.PREVIEW_DIR)
  : fileURLToPath(new URL('../dist', import.meta.url))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

async function isFile(path) {
  return stat(path).then(
    (s) => s.isFile(),
    () => false,
  )
}

async function isDir(path) {
  return stat(path).then(
    (s) => s.isDirectory(),
    () => false,
  )
}

const server = createServer(async (req, res) => {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', `http://${HOST}`).pathname)
  } catch {
    res.writeHead(400).end()
    return
  }
  const rules = rulesFor(pathname)
  if (rules.length > 1) {
    res.writeHead(500).end(`More than one _headers rule matches ${pathname}`)
    return
  }
  for (const [name, value] of Object.entries(rules[0]?.headers ?? {})) res.setHeader(name, value)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end()
    return
  }

  const file = normalize(join(dist, pathname))
  if (file !== dist && !file.startsWith(dist + sep)) {
    res.writeHead(403).end()
    return
  }

  let target = file
  if (await isDir(file)) {
    // Like a static host: /app redirects to /app/, and a folder serves its index.html.
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/` }).end()
      return
    }
    target = join(file, 'index.html')
  }
  if (target.endsWith(`${sep}_headers`) || !(await isFile(target))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
    return
  }

  res.writeHead(200, {
    'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  })
  if (req.method === 'HEAD') res.end()
  else createReadStream(target).pipe(res)
})

server.on('error', (err) => {
  console.error(`Could not serve dist/ on ${HOST}:${PORT}: ${err.message}`)
  process.exit(1)
})
server.listen(PORT, HOST, () => {
  console.log(`Serving dist/ at http://${HOST}:${PORT}/ (app at /app/)`)
})

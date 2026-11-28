import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_BASE } from './security-headers'

/** `vite build --mode native` (npm run build:native): the Capacitor app's web assets. */
export const NATIVE_MODE = 'native'
export const NATIVE_OUT_DIR = 'dist/native'

// Two builds from the same code:
// - web (default): one statichost.eu site for now, the landing page at / (site/, copied by
//   scripts/build-site.mjs) and the app at /app/. The app builds into dist/app, so emptying the
//   output folder only ever clears dist/app; scripts/build-site.mjs then fills the rest of dist/
//   and writes dist/_headers. The PWA (manifest and service worker) is scoped to /app/.
// - native (Capacitor, capacitor.config.ts webDir): Capacitor serves the folder from the root of
//   its own origin, so asset paths are relative ('./'), and there is no PWA: no manifest, no
//   service worker, no registerSW.js (the app is installed from the store, and a service worker
//   has nothing to do inside it). Written to dist/native, which build-site.mjs never publishes.
export default defineConfig(({ mode }) => {
  const native = mode === NATIVE_MODE
  return {
    base: native ? './' : APP_BASE,
    build: native
      ? { outDir: NATIVE_OUT_DIR, emptyOutDir: true }
      : { outDir: 'dist/app', emptyOutDir: true },
    plugins: [
      react(),
      tailwindcss(),
      !native &&
        VitePWA({
          registerType: 'autoUpdate',
          // The service worker lives at /app/sw.js and is registered with scope /app/, so it can never
          // control or cache the landing page or anything else outside /app/.
          base: APP_BASE,
          scope: APP_BASE,
          includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: 'Shelfie',
            short_name: 'Shelfie',
            description: 'A private home inventory. Your shelves stay on your device.',
            lang: 'en',
            start_url: APP_BASE,
            scope: APP_BASE,
            display: 'standalone',
            background_color: '#eef4f1',
            theme_color: '#0e6f6b',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
              {
                src: 'icon-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            // Only the app's own build files are precached. There is no runtimeCaching, so nothing
            // from another origin (Supabase auth or data on *.supabase.co) is ever cached; keep it
            // that way (e2e/auth.spec.ts checks the caches after signing in).
            globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
            navigateFallback: `${APP_BASE}index.html`,
            navigateFallbackAllowlist: [/^\/app\//],
          },
        }),
    ],
    test: {
      // Unit tests run in Node. Component tests (*.test.tsx, src/ui only) opt into jsdom with a
      // `// @vitest-environment jsdom` line at the top of the file.
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/ui/**/*.test.tsx', 'supabase/functions/**/*.test.ts'],
    },
  }
})

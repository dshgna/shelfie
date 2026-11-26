import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_BASE } from './security-headers'

// One statichost.eu site for now: the landing page at / (site/, copied by scripts/build-site.mjs)
// and the app at /app/. The app builds into dist/app, so emptying the output folder only ever
// clears dist/app; scripts/build-site.mjs then fills the rest of dist/ and writes dist/_headers.
export default defineConfig({
  base: APP_BASE,
  build: { outDir: 'dist/app', emptyOutDir: true },
  plugins: [
    react(),
    tailwindcss(),
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
})

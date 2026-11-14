import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { securityHeaders, toHeadersFile } from './security-headers'

/** Emits dist/_headers so the production host applies the same policy the tests run under. */
function emitHeadersFile(): Plugin {
  return {
    name: 'shelfie-emit-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: toHeadersFile() })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Shelfie',
        short_name: 'Shelfie',
        description: 'A private home inventory. Your shelves stay on your device.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f2f5f4',
        theme_color: '#0e6f6b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
    emitHeadersFile(),
  ],
  preview: { port: 4173, strictPort: true, headers: securityHeaders },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

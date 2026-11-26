import { defineConfig, devices } from '@playwright/test'
import { FAKE_ANON_KEY, FAKE_SUPABASE_ORIGIN } from './e2e/fake-supabase'

// Tests run against the production build: `npm run preview` (scripts/serve-dist.mjs) serves the
// whole dist/ folder, landing page at / and app at /app/, with the production security headers.
// baseURL is the origin, so tests open the app with page.goto('/app/') (openSignedIn signs in
// through the fake backend first).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run build && npm run preview',
    // The e2e build talks to a fake Supabase project that e2e/fake-supabase.ts answers in the
    // browser; these override any .env.local values, so no test can reach a real project.
    env: { VITE_SUPABASE_URL: FAKE_SUPABASE_ORIGIN, VITE_SUPABASE_ANON_KEY: FAKE_ANON_KEY },
    url: 'http://localhost:4173/app/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
})

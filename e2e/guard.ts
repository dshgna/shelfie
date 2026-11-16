import { expect, test as base } from '@playwright/test'

// A `test` that fails when the page asks any origin other than ours for anything, or when the
// browser reports a Content Security Policy violation, as e2e/foundation.spec.ts checks for the
// shell. Requests are watched on the whole browser context, so the service worker's count too.
// `allowedOrigins` (default none) lists outside origins a test may reach: the landing page tests
// pass `siteExtraOrigins` from security-headers.ts, which stays empty until the providers are chosen.

export const test = base.extend<{ allowedOrigins: string[]; guard: undefined }>({
  allowedOrigins: [[], { option: true }],
  guard: [
    async ({ context, baseURL, allowedOrigins }, use) => {
      const origin = new URL(baseURL ?? 'http://localhost:4173').origin
      const foreign: string[] = []
      const violations: string[] = []

      context.on('request', (req) => {
        const url = req.url()
        if (url.startsWith('data:') || url.startsWith('blob:')) return
        const from = new URL(url).origin
        if (from !== origin && !allowedOrigins.includes(from)) foreign.push(url)
      })
      context.on('console', (msg) => {
        if (/content security policy/i.test(msg.text())) violations.push(msg.text())
      })
      // The console wording is Chrome's; the DOM event is the standard signal, so report it too.
      await context.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          console.error(
            `Content Security Policy violation: ${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`,
          )
        })
      })

      await use(undefined)

      expect(foreign, 'requests to other origins').toEqual([])
      expect(violations, 'CSP violations').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

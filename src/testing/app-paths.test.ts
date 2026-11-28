import { describe, expect, it } from 'vitest'
import {
  SITE_ORIGIN,
  appBasePath,
  emailLinkBase,
  isResetPasswordPath,
  siteLink,
  type AppBuild,
} from '../app-paths'

const WEB: AppBuild = { baseUrl: '/app/', native: false }
const NATIVE: AppBuild = { baseUrl: './', native: true }

describe('app paths', () => {
  it('serves the web app at /app/ and the native app at /', () => {
    expect(appBasePath(WEB)).toBe('/app/')
    expect(appBasePath(NATIVE)).toBe('/')
  })

  it('recognises the reset link in both builds', () => {
    expect(isResetPasswordPath('/app/reset-password/', WEB)).toBe(true)
    expect(isResetPasswordPath('/app/reset-password', WEB)).toBe(true)
    expect(isResetPasswordPath('/app/', WEB)).toBe(false)
    expect(isResetPasswordPath('/reset-password/', WEB)).toBe(false)
    expect(isResetPasswordPath('/reset-password/', NATIVE)).toBe(true)
    expect(isResetPasswordPath('/', NATIVE)).toBe(false)
    expect(isResetPasswordPath('./reset-password/', NATIVE)).toBe(false)
  })

  it('sends email links to the web app, from either build', () => {
    expect(emailLinkBase(WEB, 'https://homeshelfie.com')).toBe('https://homeshelfie.com/app/')
    expect(emailLinkBase(WEB, 'http://localhost:4173')).toBe('http://localhost:4173/app/')
    expect(emailLinkBase(NATIVE, 'capacitor://localhost')).toBe(`${SITE_ORIGIN}/app/`)
  })

  it('links to the landing page on the same origin on the web, and to the site in the native app', () => {
    expect(siteLink('/terms', WEB)).toBe('/terms')
    expect(siteLink('/privacy', NATIVE)).toBe('https://homeshelfie.com/privacy')
  })
})

// Where the app lives, for the two builds:
// - web (default mode): Vite base '/app/', served at https://homeshelfie.com/app/ beside the
//   landing page;
// - native (`vite build --mode native`, Capacitor): base './', served from the root of the app's
//   own origin (capacitor://localhost/), with no landing page beside it.
// Pure functions of the build's BASE_URL and mode, so both are unit tested.

import { APP_BASE } from '../security-headers'
import { RESET_PASSWORD_PATH } from './auth/service'

/** The public site (landing page, Terms, Privacy notice, and the web app at /app/). */
export const SITE_ORIGIN = 'https://homeshelfie.com'

export interface AppBuild {
  /** import.meta.env.BASE_URL: '/app/' on the web, './' in the native build. */
  baseUrl: string
  /** import.meta.env.MODE === 'native'. */
  native: boolean
}

/** The current build, from Vite's values. */
export function currentBuild(): AppBuild {
  return { baseUrl: import.meta.env.BASE_URL, native: import.meta.env.MODE === 'native' }
}

/** The URL path the app's page is served at: '/app/' on the web, '/' in the native app. */
export function appBasePath(build: AppBuild): string {
  return build.baseUrl.startsWith('/') ? build.baseUrl : '/'
}

/** Whether this address is the reset email's link (/app/reset-password/, with or without the slash). */
export function isResetPasswordPath(pathname: string, build: AppBuild): boolean {
  const reset = `${appBasePath(build)}${RESET_PASSWORD_PATH}`
  return pathname === reset || pathname === reset.replace(/\/$/, '')
}

/**
 * Where links in Shelfie's emails (confirm sign-up, reset password, confirm new email) open: the
 * web app. The native app has no web address of its own (capacitor://localhost isn't reachable
 * from a mail client), so its emails open the web app on the site too.
 */
export function emailLinkBase(build: AppBuild, origin: string): string {
  if (build.native) return `${SITE_ORIGIN}${APP_BASE}`
  return new URL(appBasePath(build), origin).href
}

/** A landing page link (/terms, /privacy): same origin on the web, the public site in the native app. */
export function siteLink(path: `/${string}`, build: AppBuild): string {
  return build.native ? `${SITE_ORIGIN}${path}` : path
}

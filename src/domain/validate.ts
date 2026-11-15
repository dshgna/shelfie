// Rules an Item must follow that its type can't express.
// validateItem only reports problems; normalizeItem returns a corrected copy.

import { isValidIsoDate } from './dates'
import type { Item } from './item'

/** Which part of the item an issue is about. */
export type IssueField = keyof Item | 'links.product' | 'links.brand'

/** A stable code for each rule, so the UI and tests don't depend on the message wording. */
export type IssueCode =
  | 'start-without-life'
  | 'start-when-out-of-stock'
  | 'share-without-life'
  | 'invalid-share'
  | 'not-whole-number'
  | 'link-scheme'
  | 'invalid-date'

export interface ValidationIssue {
  field: IssueField
  code: IssueCode
  /** Plain English, safe to show to the person. */
  message: string
}

export interface LinkCheck {
  /** True only for http:// or https:// addresses that parse. */
  ok: boolean
  /** True for http:// addresses: they work, but the connection isn't encrypted. */
  insecure: boolean
}

/** True for 0, 1, 2 and so on. False for fractions, negatives, NaN and Infinity. */
function isWholeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

function hasLife(item: Omit<Item, 'updatedAt'>): boolean {
  return item.lifeDays !== undefined && item.lifeDays > 0
}

/**
 * True for a reorder share from 0.01 (1%) to 1 (100%) with at most 2 decimals, such as 0.33.
 * Not 0: the prototype stores 0 for "not set". Rounding to hundredths and comparing works because
 * a 2-decimal number like 0.29 rounds back to the very same floating-point value.
 */
export function isValidShare(share: number): boolean {
  return share >= 0.01 && share <= 1 && Math.round(share * 100) / 100 === share
}

/** The prototype keeps a start date only while there is a lifetime and something in stock. */
function shouldClearStart(item: Omit<Item, 'updatedAt'>): boolean {
  return !hasLife(item) || !(item.quantity > 0)
}

/** True if the text has a space, tab, line break or other invisible control character. */
function hasWhitespaceOrControl(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x20 || code === 0x7f || /\s/.test(char)) return true
  }
  return false
}

// Characters that may never appear in a host name: the WHATWG URL standard's
// "forbidden host code points" that can reach this point, plus "%".
const FORBIDDEN_IN_HOST = '#%/:<>?@[\\]^|'

function isValidHost(host: string): boolean {
  if (host === '') return false
  // IPv6 address in brackets, such as [::1]
  if (host.startsWith('[')) return /^\[[0-9a-f:.]+\]$/i.test(host)
  for (const char of host) {
    if (FORBIDDEN_IN_HOST.includes(char)) return false
  }
  // No empty labels: rejects ".example.com" and "example..com". A final dot ("example.com.") is valid.
  const labels = host.replace(/\.$/, '').split('.')
  return labels.every((label) => label !== '')
}

/** An empty port ("example.com:") is allowed, as in browsers; otherwise 0 to 65535. */
function isValidPort(port: string): boolean {
  if (port === '') return true
  return /^\d{1,5}$/.test(port) && Number(port) <= 65535
}

/**
 * Checks a web address without the URL class, which src/domain can't use (it comes from the
 * browser or Node, not from plain JavaScript). Stricter than browsers on purpose: it rejects
 * whitespace anywhere, and a "user@" part before the host (a common way to disguise where a
 * link really goes).
 */
export function isSafeLink(url: string): LinkCheck {
  const rejected: LinkCheck = { ok: false, insecure: false }
  if (hasWhitespaceOrControl(url)) return rejected

  // Scheme, then "//", then everything up to the first "/", "?" or "#" is the authority.
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)(.*)$/i.exec(url)
  if (!match) return rejected
  const [, scheme = '', authority = ''] = match

  const lowerScheme = scheme.toLowerCase()
  if (lowerScheme !== 'http' && lowerScheme !== 'https') return rejected
  if (authority.includes('@')) return rejected

  // Split off ":port". For IPv6 the port comes after the closing bracket.
  const portMatch = /^(.*?)(?::(\d*))?$/.exec(authority)
  const host = portMatch?.[1] ?? ''
  const port = portMatch?.[2]
  if (port !== undefined && !isValidPort(port)) return rejected
  if (!isValidHost(host)) return rejected

  return { ok: true, insecure: lowerScheme === 'http' }
}

/**
 * Lists every rule the item breaks. Never changes the item. An empty list means it is valid.
 * Runs before saving, so the item needn't have `updatedAt` yet (the repository sets it).
 */
export function validateItem(item: Omit<Item, 'updatedAt'>): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Every calendar-date field on Item (updatedAt is set by the repository, so it isn't checked
  // here). The date helpers in dates.ts throw on bad dates, so catch them here.
  const dates: Array<['startedOn' | 'expiresOn', string | undefined]> = [
    ['startedOn', item.startedOn],
    ['expiresOn', item.expiresOn],
  ]
  for (const [field, date] of dates) {
    if (date !== undefined && !isValidIsoDate(date)) {
      issues.push({
        field,
        code: 'invalid-date',
        message: 'This must be a real date written as YYYY-MM-DD, for example 2026-11-14.',
      })
    }
  }

  if (item.startedOn !== undefined) {
    if (!hasLife(item)) {
      issues.push({
        field: 'startedOn',
        code: 'start-without-life',
        message: 'A start date needs a lifetime (how many days one lasts).',
      })
    }
    if (!(item.quantity > 0)) {
      issues.push({
        field: 'startedOn',
        code: 'start-when-out-of-stock',
        message: 'A start date only applies while there is one in stock.',
      })
    }
  }

  if (item.reorder.kind === 'share' && !hasLife(item)) {
    issues.push({
      field: 'reorder',
      code: 'share-without-life',
      message: 'Reordering by how much is used up needs a lifetime (how many days one lasts).',
    })
  }

  if (item.reorder.kind === 'share' && !isValidShare(item.reorder.share)) {
    issues.push({
      field: 'reorder',
      code: 'invalid-share',
      message: 'Reorder at must be between 1% and 100%, with at most 2 decimals.',
    })
  }

  const counts: Array<['quantity' | 'buyUpTo' | 'lifeDays', number | undefined]> = [
    ['quantity', item.quantity],
    ['buyUpTo', item.buyUpTo],
    ['lifeDays', item.lifeDays],
  ]
  for (const [field, value] of counts) {
    if (value !== undefined && !isWholeNumber(value)) {
      issues.push({
        field,
        code: 'not-whole-number',
        message: 'This must be a whole number, 0 or more.',
      })
    }
  }

  const links: Array<['links.product' | 'links.brand', string | undefined]> = [
    ['links.product', item.links.product],
    ['links.brand', item.links.brand],
  ]
  for (const [field, link] of links) {
    if (link !== undefined && !isSafeLink(link).ok) {
      issues.push({
        field,
        code: 'link-scheme',
        message: 'Links must be web addresses starting with http:// or https://.',
      })
    }
  }

  return issues
}

/**
 * Returns a corrected copy of the item. The only correction is the prototype's rule:
 * the start date is cleared when there is no lifetime or nothing in stock.
 * The item passed in is never changed. Runs before saving, so the item needn't have `updatedAt`
 * yet; the result has the same type as the item passed in (an Item stays an Item).
 */
export function normalizeItem<T extends Omit<Item, 'updatedAt'>>(item: T): T {
  // Copy the nested objects too, so changing the result can never reach the original.
  const copy: T = { ...item, reorder: { ...item.reorder }, links: { ...item.links } }
  if (shouldClearStart(item)) delete copy.startedOn
  return copy
}

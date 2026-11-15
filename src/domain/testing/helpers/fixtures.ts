// Shared test data for the tests in src/domain/testing/. Test files only: app code must never
// import this (src/fixtures-usage.test.ts fails if it does).
//
// Everything here is invented: no real products, brands, shops, people or inventories.
// Links use reserved example domains (RFC 2606), which can never belong to anyone.

import type { IsoDateTime } from '../../dates'
import { defaultHouseholdPrefs, type Household } from '../../household'
import { CURRENT_SCHEMA_VERSION, type Item } from '../../item'
import type { ItemRecord } from '../../item-record'
import type { Purchase } from '../../stock'
import { defaultUserPrefs, type User } from '../../user'

/** The "today" most tests use. Tests that need a different day pass their own. */
export const TODAY = '2026-11-14'

/** A moment on TODAY, in UTC, for createdAt and updatedAt fields. */
export const NOW: IsoDateTime = '2026-11-14T09:30:00.000Z'

/**
 * A valid, invented item at CURRENT_SCHEMA_VERSION: 3 tubes in stock, reorder at 1 left, no
 * lifetime, no dates, no links. validateItem finds nothing wrong with it, and its status is 'ok'.
 * Pass overrides for the fields a test is about.
 */
export function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'test-item',
    name: 'Peppermint Toothpaste',
    brand: 'Example Naturals',
    category: 'dental',
    group: 'Dental Care',
    location: 'Bathroom shelf',
    quantity: 3,
    unit: 'tube',
    size: '75 ml',
    reorder: { kind: 'count', atOrBelow: 1 },
    buyUpTo: 3,
    notes: '',
    links: {},
    isExample: false,
    ...overrides,
  }
}

/**
 * A valid, invented purchase: 3 bottles of shampoo, 30 days each, bought on TODAY.
 * Pass overrides for the fields a test is about.
 */
export function makePurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    count: 3,
    lifeDays: 30,
    boughtOn: TODAY,
    name: 'Rosemary Shampoo',
    size: '250 ml',
    unit: 'bottle',
    category: 'hair',
    ...overrides,
  }
}

/** A valid, invented household, created at NOW. Pass overrides for the fields a test is about. */
export function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: 'test-household',
    name: 'Example Home',
    createdAt: NOW,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    householdPrefs: defaultHouseholdPrefs(),
    ...overrides,
  }
}

/**
 * A valid, invented user in the makeHousehold() household, with default preferences and sync
 * off, so no key fields. Pass overrides for the fields a test is about.
 */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user',
    householdId: 'test-household',
    createdAt: NOW,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    userPrefs: defaultUserPrefs(),
    syncOn: false,
    ...overrides,
  }
}

/**
 * makeItem() as storage keeps it: in the makeHousehold() household, created and last changed at
 * NOW, not deleted. Pass overrides for the fields a test is about.
 */
export function makeItemRecord(overrides: Partial<ItemRecord> = {}): ItemRecord {
  return {
    ...makeItem(),
    householdId: 'test-household',
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false,
    ...overrides,
  }
}

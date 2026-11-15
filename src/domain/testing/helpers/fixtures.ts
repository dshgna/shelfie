// Shared test data for src/domain tests. Test files only: app code must never import this
// (src/fixtures-usage.test.ts fails if it does).
//
// Everything here is invented: no real products, brands, shops, people or inventories.
// Links use reserved example domains (RFC 2606), which can never belong to anyone.

import { CURRENT_SCHEMA_VERSION, type Item } from '../item'
import type { Purchase } from '../stock'

/** The "today" most tests use. Tests that need a different day pass their own. */
export const TODAY = '2026-11-14'

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

// The shelf sections shown as pill tabs under Inventory, ported from the prototype's SECTIONS.
// The prototype's "Household Basics" section is left out: its only category ('basics') was removed
// from the domain, and migrations.ts moves those items to 'household' (Home Care).

import type { Category } from '../domain/item'

export type SectionKey = 'personal' | 'home' | 'laundry' | 'health'

export interface Section {
  key: SectionKey
  label: string
  categories: readonly Category[]
}

export const SECTIONS: readonly Section[] = [
  { key: 'personal', label: 'Personal Care', categories: ['skincare', 'hair', 'beauty', 'dental'] },
  { key: 'home', label: 'Home Care', categories: ['household', 'kitchen', 'bathroom'] },
  { key: 'laundry', label: 'Laundry', categories: ['laundry'] },
  { key: 'health', label: 'Health & Personal', categories: ['health'] },
]

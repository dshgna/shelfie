// What the Inventory tab shows and in what order (src/ui/shelf-view.ts). Invented data only.

import { describe, expect, it } from 'vitest'
import { plusDays } from '../../domain/dates'
import type { Item } from '../../domain/item'
import { TODAY, makeItem } from '../../domain/testing/helpers/fixtures'
import { NO_FILTERS, type FilterState } from '../Filters'
import { CATEGORY_LABELS, shelvesFor, type View } from '../shelf-view'

function view(overrides: Partial<Omit<View, 'filters'>> & { filters?: Partial<FilterState> } = {}) {
  return {
    query: overrides.query ?? '',
    section: overrides.section ?? 'all',
    filters: { ...NO_FILTERS, ...overrides.filters },
  }
}

/** The ids shown, in order, flattened across categories and shelves. */
function ids(items: Item[], v: View = view()): string[] {
  return shelvesFor(items, v, TODAY).flatMap((c) =>
    c.shelves.flatMap((s) => s.items.map((i) => i.id)),
  )
}

const soap = makeItem({ id: 'soap', name: 'Dish Soap', category: 'kitchen', group: 'Dishwashing' })
const sponges = makeItem({
  id: 'sponges',
  name: 'Sponges',
  category: 'kitchen',
  group: 'Dishwashing',
  quantity: 0,
})
const bags = makeItem({ id: 'bags', name: 'Bin Bags', category: 'kitchen', group: 'Waste & Paper' })
const toner = makeItem({
  id: 'toner',
  name: 'Toner',
  brand: 'Fernleaf',
  category: 'skincare',
  group: 'Step 3 · Toner',
  location: 'Bathroom shelf',
  expiresOn: plusDays(TODAY, 10),
})
const custom = makeItem({ id: 'scrubber', name: 'Scrubber', category: 'kitchen', group: 'Brushes' })
const all = [soap, sponges, bags, toner, custom]

describe('grouping', () => {
  it('groups by category in CATEGORIES order, labelled from CATEGORY_LABELS', () => {
    const result = shelvesFor(all, view(), TODAY)
    expect(result.map((c) => [c.category, c.label])).toEqual([
      ['skincare', CATEGORY_LABELS.skincare],
      ['kitchen', CATEGORY_LABELS.kitchen],
    ])
  })

  it("orders shelves by the category's default groups, then others A to Z", () => {
    const kitchen = shelvesFor(all, view(), TODAY).find((c) => c.category === 'kitchen')
    expect(kitchen?.shelves.map((s) => s.group)).toEqual([
      'Dishwashing',
      'Waste & Paper',
      'Brushes',
    ])
  })

  it('leaves out categories with nothing to show', () => {
    expect(shelvesFor([], view(), TODAY)).toEqual([])
    expect(shelvesFor(all, view({ query: 'nothing like this' }), TODAY)).toEqual([])
  })
})

describe('filters', () => {
  it('shows one section', () => {
    expect(ids(all, view({ section: 'personal' }))).toEqual(['toner'])
    expect(ids(all, view({ section: 'laundry' }))).toEqual([])
  })

  it('searches name, brand, place, notes and shelf, ignoring case', () => {
    const noted = makeItem({ id: 'noted', notes: 'Lavender scent' })
    expect(ids([...all, noted], view({ query: 'FERNLEAF' }))).toEqual(['toner'])
    expect(ids([...all, noted], view({ query: 'bathroom shelf' }))).toContain('toner')
    expect(ids([...all, noted], view({ query: 'lavender' }))).toEqual(['noted'])
    expect(ids([...all, noted], view({ query: 'waste' }))).toEqual(['bags'])
    expect(ids(all, view({ query: '  toner  ' }))).toEqual(['toner'])
  })

  it('filters by place and brand', () => {
    expect(ids(all, view({ filters: { place: 'Bathroom shelf', brand: 'Fernleaf' } }))).toEqual([
      'toner',
    ])
  })

  it('shows what needs restocking, what is expiring, or either', () => {
    expect(ids(all, view({ filters: { show: 'restock' } }))).toEqual(['sponges'])
    expect(ids(all, view({ filters: { show: 'expiring' } }))).toEqual(['toner'])
    expect(ids(all, view({ filters: { show: 'attention' } }))).toEqual(['toner', 'sponges'])
  })
})

describe('sorting within a shelf', () => {
  const a = makeItem({ id: 'a', name: 'Apple Soap', quantity: 3, buyUpTo: 3 })
  const b = makeItem({ id: 'b', name: 'Basil Soap', quantity: 1, buyUpTo: 3 })
  const c = makeItem({
    id: 'c',
    name: 'Cedar Soap',
    quantity: 2,
    buyUpTo: 3,
    expiresOn: plusDays(TODAY, 5),
  })

  it('sorts by name by default', () => {
    expect(ids([c, b, a])).toEqual(['a', 'b', 'c'])
  })

  it('sorts by lowest stock', () => {
    expect(ids([a, b, c], view({ filters: { sort: 'stock' } }))).toEqual(['b', 'c', 'a'])
  })

  it('sorts by soonest expiry, items without one last', () => {
    expect(ids([a, b, c], view({ filters: { sort: 'expiry' } }))).toEqual(['c', 'a', 'b'])
  })
})

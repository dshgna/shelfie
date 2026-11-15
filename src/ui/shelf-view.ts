// Which items the Inventory tab shows, in what order, and how they are grouped: by category, then
// by shelf (the item's group). Ported from the prototype's filtered(), sorter() and the grouping
// in renderList(). Stock and expiry rules come from src/domain; nothing here re-implements them.

import { daysUntil, type IsoDate } from '../domain/dates'
import { CATEGORIES, DEFAULT_GROUPS, type Category, type Group, type Item } from '../domain/item'
import { needsExpiry, needsRestock, stockLeft } from '../domain/status'
import type { FilterState } from './Filters'
import { SECTIONS, type SectionKey } from './sections'

/** Category headings, from the prototype's CATS labels. */
export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  skincare: 'Skincare',
  hair: 'Body & Bath',
  beauty: 'Beauty',
  dental: 'Dental',
  household: 'Household Cleaning',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  laundry: 'Laundry',
  health: 'Health & Personal',
}

export interface View {
  query: string
  section: SectionKey | 'all'
  filters: FilterState
}

function matches(item: Item, view: View, today: IsoDate): boolean {
  const { filters } = view
  if (view.section !== 'all') {
    const section = SECTIONS.find((s) => s.key === view.section)
    if (!section?.categories.includes(item.category)) return false
  }
  if (filters.place !== 'all' && item.location !== filters.place) return false
  if (filters.brand !== 'all' && item.brand !== filters.brand) return false
  const restock = needsRestock(item, today)
  const expiry = needsExpiry(item, today)
  if (filters.show === 'attention' && !(restock || expiry)) return false
  if (filters.show === 'restock' && !restock) return false
  if (filters.show === 'expiring' && !expiry) return false
  const query = view.query.trim().toLowerCase()
  if (query) {
    const text = [item.name, item.brand, item.location, item.notes, item.group].join(' ')
    if (!text.toLowerCase().includes(query)) return false
  }
  return true
}

function compare(view: View, today: IsoDate): (a: Item, b: Item) => number {
  const byName = (a: Item, b: Item) => a.name.localeCompare(b.name)
  switch (view.filters.sort) {
    case 'stock':
      return (a, b) => stockLeft(a, today) - stockLeft(b, today) || byName(a, b)
    case 'expiry': {
      const days = (item: Item) =>
        item.expiresOn === undefined ? Infinity : daysUntil(today, item.expiresOn)
      return (a, b) => days(a) - days(b) || byName(a, b)
    }
    case 'name':
      return byName
  }
}

export interface Shelf {
  group: Group
  items: Item[]
}

export interface CategoryShelves {
  category: Category
  label: string
  shelves: Shelf[]
}

/** The order of a category's shelves: its default groups first, then any others A to Z. */
function shelfOrder(category: Category): (a: Group, b: Group) => number {
  const defaults = DEFAULT_GROUPS[category]
  const rank = (group: Group) => {
    const i = defaults.indexOf(group)
    return i < 0 ? defaults.length : i
  }
  return (a, b) => rank(a) - rank(b) || a.localeCompare(b)
}

/**
 * The items that match `view`, sorted, grouped by category (in CATEGORIES order) and then by
 * shelf. Categories and shelves with no matching items are left out.
 */
export function shelvesFor(items: readonly Item[], view: View, today: IsoDate): CategoryShelves[] {
  const visible = items.filter((item) => matches(item, view, today)).sort(compare(view, today))
  return CATEGORIES.flatMap((category) => {
    const inCategory = visible.filter((item) => item.category === category)
    if (inCategory.length === 0) return []
    const groups = [...new Set(inCategory.map((item) => item.group))].sort(shelfOrder(category))
    const shelves = groups.map((group) => ({
      group,
      items: inCategory.filter((item) => item.group === group),
    }))
    return [{ category, label: CATEGORY_LABELS[category], shelves }]
  })
}

// The review step's rules: rows from the reader's reply, each row's estimate, the item it tops up,
// editing a row, and what adding the rows saves. Ported from the prototype's drawReview, estText,
// lifeText, onRowEdit and doAdd. Every rule comes from src/domain (normRow, findMatch, calcStock,
// guessDays, validateItem, normalizeItem). Rows live in memory only: nothing here is stored until
// the person adds them.

import { isValidIsoDate, type IsoDate } from '../../domain/dates'
import {
  CURRENT_SCHEMA_VERSION,
  type Category,
  type Group,
  type Item,
  type Unit,
} from '../../domain/item'
import { isValidRecordQuantity, type ItemPurchaseRecord } from '../../domain/item-purchase-record'
import { findMatch, normRow, type ImportDraft, type Shelf } from '../../domain/import-rows'
import { DEFAULT_SHARE } from '../../domain/status'
import { calcStock, type StockEstimate } from '../../domain/stock'
import { guessDays } from '../../domain/typical'
import { normalizeItem, validateItem } from '../../domain/validate'
import type { FormErrors, FormValues } from '../item-form'
import type { ReadOrdersReply } from './read-orders'

export interface ReviewRow {
  /** Stable within this review, for React keys and focus. */
  key: string
  draft: ImportDraft
  /** Ticked: add it. */
  include: boolean
  /** Days one lasts, when the person changed it; otherwise the typical estimate is used. */
  lifeOverride?: number
  /** The shelves the reader offered: its own choice, then its alternatives. Fixed per row. */
  offered: Shelf[]
}

/** The rows normRow could read; rows it rejects (no name, not an object) are left out. */
export function rowsFromReply(reply: ReadOrdersReply, today: IsoDate): ReviewRow[] {
  return reply.rows.flatMap((raw, index) => {
    const result = normRow(raw, today)
    if (!result.ok) return []
    const { draft } = result
    const offered = [{ category: draft.category, group: draft.group }, ...draft.alternatives]
    return [{ key: `row-${index}`, draft, include: true, offered }]
  })
}

/** The typical lifetime for the row (prototype "Typical: about N days"). */
export function typicalLife(row: ReviewRow): number {
  const { name, size, unit, category } = row.draft
  return guessDays(name, size, unit, category)
}

/** calcStock's estimate for the row: lifetime, how many used up, how many left, start date. */
export function estimate(row: ReviewRow, today: IsoDate): StockEstimate {
  const { quantity, boughtAt, size, unit, name, category } = row.draft
  return calcStock(
    { quantity, boughtAt, size, unit, name, category, lifeDays: row.lifeOverride },
    today,
  )
}

/** Gift or return rows and unticked rows are left out. */
export function isAdded(row: ReviewRow): boolean {
  return row.include && row.draft.mark === 'mine'
}

/** The stored item this row tops up, if any (the domain's findMatch). */
export function matchFor(row: ReviewRow, items: readonly Item[]): Item | undefined {
  return findMatch(row.draft, items)
}

/** "All 2 unused so far", "About 1 of 2 left" or "Probably all used up" (prototype estText). */
export function estimateText(row: ReviewRow, today: IsoDate): string {
  const { left } = estimate(row, today)
  const count = row.draft.quantity
  if (left === count) return count === 1 ? 'Unused so far' : `All ${count} unused so far`
  return left > 0 ? `About ${left} of ${count} left` : 'Probably all used up'
}

/**
 * The shelves to offer as chips: the ones the reader offered, in order, plus the row's current
 * shelf when the person picked another one in the editor. No shelf is listed twice.
 */
export function shelfChoices(row: ReviewRow): Shelf[] {
  const current = { category: row.draft.category, group: row.draft.group }
  const same = (a: Shelf, b: Shelf) => a.category === b.category && a.group === b.group
  const choices: Shelf[] = []
  for (const shelf of [...row.offered, current]) {
    if (!choices.some((c) => same(c, shelf))) choices.push(shelf)
  }
  return choices
}

/** Puts the row on another shelf. */
export function moveTo(row: ReviewRow, shelf: Shelf): ReviewRow {
  return { ...row, draft: { ...row.draft, category: shelf.category, group: shelf.group } }
}

/** The editor's starting values: the row's fields, with days showing the estimate in use. */
export function editorValues(row: ReviewRow, today: IsoDate): FormValues {
  const { draft } = row
  return {
    name: draft.name,
    brand: draft.brand,
    size: draft.size,
    count: String(draft.quantity),
    bought: draft.boughtAt,
    category: draft.category,
    group: draft.group,
    days: String(estimate(row, today).lifeDays),
  }
}

export type EditResult = { ok: true; row: ReviewRow } | { ok: false; errors: FormErrors }

/**
 * Applies the editor's values to the row, or says what is wrong next to each field. The rules are
 * the domain's: a name (validateItem's missing-name), a count bought that is a whole number, 1 or
 * more (isValidRecordQuantity), a real purchase date, and days that are a whole number. Days
 * different from the estimate in use become the row's own; the same number keeps it as it was,
 * and blank or 0 goes back to the typical estimate.
 */
export function applyEdit(row: ReviewRow, values: FormValues, today: IsoDate): EditResult {
  const errors: FormErrors = { fields: {}, other: [] }
  const name = values.name.trim()
  const count = values.count.trim() === '' ? Number.NaN : Number(values.count)
  const bought = values.bought.trim() === '' ? today : values.bought.trim()
  const days = values.days.trim() === '' ? undefined : Number(values.days)

  const nameIssue = validateItem({ ...placeholderItem(), name }).find(
    (issue) => issue.code === 'missing-name',
  )
  if (nameIssue) errors.fields.name = nameIssue.message
  if (!isValidRecordQuantity(count)) errors.fields.count = 'This must be a whole number, 1 or more.'
  if (!isValidIsoDate(bought)) {
    errors.fields.bought = 'This must be a real date written as YYYY-MM-DD, for example 2026-11-14.'
  }
  // Days: validateItem's rule for lifeDays (a whole number, 0 or more); 0 means the typical one.
  if (days !== undefined) {
    const daysIssue = validateItem({ ...placeholderItem(), lifeDays: days }).find(
      (issue) => issue.field === 'lifeDays',
    )
    if (daysIssue) errors.fields.days = daysIssue.message
  }
  if (Object.keys(errors.fields).length > 0) return { ok: false, errors }

  const draft: ImportDraft = {
    ...row.draft,
    name,
    brand: values.brand.trim(),
    size: values.size.trim(),
    quantity: count,
    boughtAt: bought,
    category: values.category,
    group: values.group || 'Other',
  }
  const next: ReviewRow = { ...row, draft }
  const shown = estimate(row, today).lifeDays
  if (days === undefined || days === 0) delete next.lifeOverride
  else if (days !== shown) next.lifeOverride = days
  return { ok: true, row: next }
}

/** Back to the typical estimate (prototype "Use typical"). */
export function resetLife(row: ReviewRow): ReviewRow {
  const next = { ...row }
  delete next.lifeOverride
  return next
}

/** A valid item used only to ask validateItem about one field. */
function placeholderItem(): Omit<Item, 'updatedAt'> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'check',
    householdId: 'check',
    name: 'check',
    brand: '',
    category: 'household',
    group: 'Other',
    location: '',
    quantity: 0,
    unit: 'bottle',
    size: '',
    reorder: { kind: 'count', atOrBelow: 0 },
    buyUpTo: 0,
    notes: '',
    isExample: false,
    deleted: false,
  }
}

/** Prototype TEN: units bought one at a time, so the item aims to keep 1 instead of 2. */
const BUY_ONE: readonly Unit[] = ['bottle', 'tube', 'bar']

/** One thing adding will save: an item (new, or topped up) and its new purchase record. */
export interface Addition {
  item: Omit<Item, 'updatedAt'>
  purchase: Omit<ItemPurchaseRecord, 'addedAt' | 'updatedAt'>
  /** The name of the stored item it tops up, or undefined for a new item. */
  topsUp?: string
  shelf: { category: Category; group: Group }
}

export interface Ids {
  item: () => string
  purchase: () => string
}

/**
 * What adding the rows saves, in order (prototype doAdd). Only added rows (ticked, and not a gift
 * or return) count. A row matching a stored item tops it up: its stock goes up by the estimate's
 * `left`, it takes the estimate's lifetime if it had none, and the start date moves to the
 * estimate's when it was out of stock or had none. Two rows topping up the same item add up.
 * Any other row becomes a new item. Every item goes through normalizeItem and validateItem;
 * rows that would make an invalid item are returned in `skipped` instead.
 */
export function additionsFor(
  rows: readonly ReviewRow[],
  stored: readonly Item[],
  householdId: string,
  today: IsoDate,
  ids: Ids,
): { additions: Addition[]; skipped: ReviewRow[] } {
  const working = new Map(stored.map((item) => [item.id, item]))
  const additions: Addition[] = []
  const skipped: ReviewRow[] = []

  for (const row of rows.filter(isAdded)) {
    const { draft } = row
    const stock = estimate(row, today)
    const match = findMatch(draft, [...working.values()])
    let item: Omit<Item, 'updatedAt'>
    if (match) {
      const wasOut = match.quantity <= 0
      item = { ...match, quantity: match.quantity + stock.left }
      delete (item as Partial<Item>).updatedAt
      if (!(match.lifeDays !== undefined && match.lifeDays > 0)) item.lifeDays = stock.lifeDays
      if (stock.left > 0 && stock.startedOn !== undefined && (wasOut || !match.startedOn)) {
        item.startedOn = stock.startedOn
      }
    } else {
      const shop = draft.shop ? ` from ${draft.shop}` : ''
      item = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id: ids.item(),
        householdId,
        name: draft.name,
        brand: draft.brand,
        category: draft.category,
        group: draft.group,
        location: '',
        quantity: stock.left,
        unit: draft.unit,
        size: draft.size,
        lifeDays: stock.lifeDays,
        reorder: { kind: 'share', share: DEFAULT_SHARE },
        buyUpTo: BUY_ONE.includes(draft.unit) ? 1 : 2,
        notes: `Imported${shop}, bought ${draft.boughtAt}`,
        isExample: false,
        deleted: false,
      }
      if (stock.startedOn !== undefined) item.startedOn = stock.startedOn
      if (draft.link !== undefined) item.link = draft.link
    }
    const normalized = normalizeItem(item)
    if (
      normalized.schemaVersion !== CURRENT_SCHEMA_VERSION ||
      validateItem(normalized).length > 0
    ) {
      skipped.push(row)
      continue
    }
    working.set(normalized.id, { ...normalized, updatedAt: match?.updatedAt ?? '' })
    additions.push({
      item: normalized,
      purchase: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id: ids.purchase(),
        itemId: normalized.id,
        quantity: draft.quantity,
        size: draft.size,
        unit: draft.unit,
        boughtAt: draft.boughtAt,
      },
      ...(match ? { topsUp: match.name } : {}),
      shelf: { category: normalized.category, group: normalized.group },
    })
  }
  return { additions, skipped }
}

/** The done step's sentence, in plain words. */
export function doneText(added: number, toppedUp: number, leftOut: number): string {
  const parts: string[] = []
  const newOnes = added - toppedUp
  if (newOnes > 0)
    parts.push(`${newOnes} new item${newOnes === 1 ? '' : 's'} added to your shelves.`)
  if (toppedUp > 0)
    parts.push(`${toppedUp} item${toppedUp === 1 ? '' : 's'} you already had topped up.`)
  if (leftOut > 0) {
    parts.push(
      `${leftOut} left out as ${leftOut === 1 ? 'a gift, a return or unticked' : 'gifts, returns or unticked'}.`,
    )
  }
  return parts.length > 0 ? parts.join(' ') : 'Nothing was added.'
}

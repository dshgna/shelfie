// The item editor's rules, kept out of the component. Ported from the prototype's "Fill my
// shelves" review editor (Name, Brand, Size, Count, Bought, Shelf, Group, Days one lasts, saved
// through calcStock) and, for existing items, its item form (submitForm: "In stock", the start
// date rule). Every rule comes from src/domain: validateItem, normalizeItem, isValidRecordQuantity,
// isValidIsoDate, calcStock and guessDays.

import { isValidIsoDate, type IsoDate } from '../domain/dates'
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_GROUPS,
  type Category,
  type Group,
  type Item,
  type Unit,
} from '../domain/item'
import { isValidRecordQuantity, type ItemPurchaseRecord } from '../domain/item-purchase-record'
import { DEFAULT_SHARE } from '../domain/status'
import { calcStock } from '../domain/stock'
import { guessDays } from '../domain/typical'
import { normalizeItem, validateItem } from '../domain/validate'

/** What the form holds: text, as typed. */
export interface FormValues {
  name: string
  brand: string
  size: string
  /** Units bought (adding) or in stock (editing). */
  count: string
  /** The purchase date, YYYY-MM-DD; '' means today. Adding only. */
  bought: string
  category: Category
  group: Group
  /** Days one lasts; '' means the typical estimate. */
  days: string
}

export type FormField = 'name' | 'count' | 'bought' | 'days'

export interface FormErrors {
  /** Messages shown next to a field. */
  fields: Partial<Record<FormField, string>>
  /** Problems that belong to no single field. */
  other: string[]
}

/** The prototype's limits on how much can be typed (its maxlength attributes). */
export const MAX_LENGTH = { name: 80, brand: 60, size: 30 } as const

/** The unit a new item starts with: the prototype's form default. */
const NEW_UNIT: Unit = 'bottle'

/** Prototype TEN: units bought one at a time, so the item aims to keep 1 instead of 2. */
const BUY_ONE: readonly Unit[] = ['bottle', 'tube', 'bar']

/** A category's groups, then 'Other' (prototype subOpts), plus the item's own if it isn't there. */
export function groupOptions(category: Category, current?: Group): Group[] {
  const groups = [...DEFAULT_GROUPS[category]]
  if (!groups.includes('Other')) groups.push('Other')
  if (current !== undefined && current !== '' && !groups.includes(current)) groups.push(current)
  return groups
}

/** The first group of a category, chosen when the shelf changes (prototype). */
export function firstGroup(category: Category): Group {
  return groupOptions(category)[0] ?? 'Other'
}

/** A blank form for a new item. Kitchen is the prototype's default shelf. */
export function newValues(category: Category = 'kitchen'): FormValues {
  return {
    name: '',
    brand: '',
    size: '',
    count: '1',
    bought: '',
    category,
    group: firstGroup(category),
    days: '',
  }
}

export function valuesFromItem(item: Item): FormValues {
  return {
    name: item.name,
    brand: item.brand,
    size: item.size,
    count: String(item.quantity),
    bought: '',
    category: item.category,
    group: item.group,
    days: item.lifeDays !== undefined && item.lifeDays > 0 ? String(item.lifeDays) : '',
  }
}

/** The typical lifetime the domain would guess for what is typed so far. */
export function typicalDays(values: FormValues, unit: Unit = NEW_UNIT): number {
  return guessDays(values.name.trim(), values.size.trim(), unit, values.category)
}

/** '' is not 0: an empty box is "nothing typed", so it fails the whole-number rules. */
function parseCount(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text)
}

/** '' leaves the days unset (typical estimate); anything else is checked by validateItem. */
function parseDays(text: string): number | undefined {
  return text.trim() === '' ? undefined : Number(text)
}

const FIELD_OF: Partial<Record<keyof Item, FormField>> = {
  name: 'name',
  quantity: 'count',
  lifeDays: 'days',
}

function collect(item: Omit<Item, 'updatedAt'>, errors: FormErrors): void {
  for (const issue of validateItem(item)) {
    const field = FIELD_OF[issue.field as keyof Item]
    if (field && errors.fields[field] === undefined) errors.fields[field] = issue.message
    else if (!field) errors.other.push(issue.message)
  }
}

const hasErrors = (errors: FormErrors) =>
  Object.keys(errors.fields).length > 0 || errors.other.length > 0

export type EditResult =
  | { ok: true; item: Omit<Item, 'updatedAt'>; purchase?: undefined }
  | { ok: false; errors: FormErrors }

/**
 * The changed item, or what is wrong. Count is the number in stock (0 or more). As in the
 * prototype's form: blank days on an item that reorders by share use the typical estimate (a
 * share rule needs a lifetime); a start date is set to today when there is a lifetime and stock
 * but none was set; normalizeItem clears it when there is no lifetime or nothing in stock.
 */
export function buildEdit(item: Item, values: FormValues, today: IsoDate): EditResult {
  const errors: FormErrors = { fields: {}, other: [] }
  const quantity = parseCount(values.count)
  let lifeDays = parseDays(values.days)
  if (lifeDays === undefined && item.reorder.kind === 'share') {
    lifeDays = guessDays(values.name.trim(), values.size.trim(), item.unit, values.category)
  }
  const next: Omit<Item, 'updatedAt'> = {
    ...item,
    name: values.name.trim(),
    brand: values.brand.trim(),
    size: values.size.trim(),
    quantity,
    category: values.category,
    group: values.group || 'Other',
  }
  delete (next as Partial<Item>).updatedAt
  if (lifeDays === undefined) delete next.lifeDays
  else next.lifeDays = lifeDays
  if (next.startedOn === undefined && lifeDays !== undefined && lifeDays > 0 && quantity > 0) {
    next.startedOn = today
  }
  const normalized = normalizeItem(next)
  collect(normalized, errors)
  return hasErrors(errors) ? { ok: false, errors } : { ok: true, item: normalized }
}

export type NewResult =
  | {
      ok: true
      item: Omit<Item, 'updatedAt'>
      purchase: Omit<ItemPurchaseRecord, 'addedAt' | 'updatedAt'>
    }
  | { ok: false; errors: FormErrors }

export interface NewIds {
  itemId: string
  purchaseId: string
}

/**
 * A new item and its first purchase record, or what is wrong. Count is the number bought (a
 * purchase record's quantity: a whole number, 1 or more). calcStock turns the count, the purchase
 * date and the days one lasts (or the typical guess) into the stock left, the lifetime and the
 * start date, as the prototype's import does. New items reorder at DEFAULT_SHARE and use the
 * prototype's defaults for what the form doesn't ask: unit bottle, buy up to 1 or 2 (TEN), no
 * place, no notes.
 */
export function buildNew(
  values: FormValues,
  ids: NewIds,
  householdId: string,
  today: IsoDate,
): NewResult {
  const errors: FormErrors = { fields: {}, other: [] }
  const count = parseCount(values.count)
  if (!isValidRecordQuantity(count)) errors.fields.count = 'This must be a whole number, 1 or more.'
  const bought = values.bought.trim() === '' ? today : values.bought.trim()
  if (!isValidIsoDate(bought)) {
    errors.fields.bought = 'This must be a real date written as YYYY-MM-DD, for example 2026-11-14.'
  }
  const days = parseDays(values.days)
  const unit = NEW_UNIT
  const base: Omit<Item, 'updatedAt'> = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: ids.itemId,
    householdId,
    name: values.name.trim(),
    brand: values.brand.trim(),
    category: values.category,
    group: values.group || 'Other',
    location: '',
    quantity: Number.isFinite(count) ? count : 0,
    unit,
    size: values.size.trim(),
    reorder: { kind: 'share', share: DEFAULT_SHARE },
    buyUpTo: BUY_ONE.includes(unit) ? 1 : 2,
    notes: '',
    isExample: false,
    deleted: false,
  }
  // Checks name and days (and the rest of the item) before calcStock, which throws on bad input.
  // The share rule needs a lifetime, so check with a placeholder one when days is blank: calcStock
  // fills in the real one.
  collect({ ...base, lifeDays: days ?? 1 }, errors)
  if (hasErrors(errors)) return { ok: false, errors }

  const stock = calcStock(
    {
      quantity: count,
      boughtAt: bought,
      size: base.size,
      unit,
      name: base.name,
      category: base.category,
      lifeDays: days,
    },
    today,
  )
  const item: Omit<Item, 'updatedAt'> = { ...base, quantity: stock.left, lifeDays: stock.lifeDays }
  if (stock.startedOn !== undefined) item.startedOn = stock.startedOn
  const normalized = normalizeItem(item)
  collect(normalized, errors)
  if (hasErrors(errors)) return { ok: false, errors }

  const purchase: Omit<ItemPurchaseRecord, 'addedAt' | 'updatedAt'> = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: ids.purchaseId,
    itemId: ids.itemId,
    quantity: count,
    size: base.size,
    unit,
    boughtAt: bought,
  }
  return { ok: true, item: normalized, purchase }
}

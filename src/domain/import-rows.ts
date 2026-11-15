// Turning one row from outside (Claude's reply in step 6, pasted text or CSV) into a clean import
// draft, and finding the stored item it tops up. Ported from the prototype's normRow, findMatch,
// norm, titleCase and cleanDate. Rules only: nothing here calls a network or a model.
//
// A draft is one line of a purchase as the import review shows it, not an Item: it has a count
// bought (`quantity`) and a purchase date (`boughtAt`), not a quantity in stock, named as on
// ItemPurchaseRecord so the review can show calcStock's estimate before anything is saved.
// The importer later turns a draft plus its StockEstimate into a new Item or a top-up.
//
// Behaviour matches the prototype, oddities included; they are noted where they happen.
// The deliberate differences are listed on normRow.

import { InvalidDateError, isValidIsoDate } from './dates'
import {
  CATEGORIES,
  DEFAULT_GROUPS,
  type Category,
  type Group,
  type IsoDate,
  type Item,
  type ItemLinks,
  type KnownUnit,
  type Unit,
} from './item'
import { isSafeLink, type IssueCode, type ValidationIssue } from './validate'

// ---------- Fixed values ----------

/**
 * Longest text kept per field; anything longer is cut. Prototype normRow's slice() limits, and
 * for unit the prototype's "name the unit" box (maxlength 20).
 */
export const TEXT_LIMITS = {
  name: 80,
  brand: 60,
  size: 30,
  unit: 20,
  shop: 40,
  reason: 120,
} as const

/** Fewest units bought per row: a count below this (or unreadable) becomes this. */
export const MIN_COUNT = 1

/** Counts above this are kept, with a warning (the prototype cut them to 99). */
export const EXPECTED_MAX_COUNT = 99

/**
 * Where a row goes when its category is unknown. The prototype used 'basics' / 'Other Basics',
 * which no longer exists. Household chosen by the owner on 14 Nov 2026 (see docs/decisions.md).
 */
export const FALLBACK_SHELF = { category: 'household', group: 'Other' } as const satisfies Shelf

/** The catch-all group every category's picker offers. */
export const OTHER_GROUP: Group = 'Other'

/** Unit used when the row has no unit, or one that isn't text. */
export const FALLBACK_UNIT: KnownUnit = 'bottle'

/**
 * Purchase dates must be after this day (not on it) and not after today; otherwise today is used.
 * Prototype cleanDate.
 */
export const EARLIEST_DATE_EXCLUSIVE: IsoDate = '2000-01-01'

/** Most "could also go in" shelves kept per row. */
export const MAX_ALTERNATIVES = 2

/** How sure the source was about the shelf. Anything else becomes 'medium'. */
export const CONFIDENCES = ['high', 'medium', 'low'] as const
export type Confidence = (typeof CONFIDENCES)[number]

/** Order line statuses the AI prompt asks for. Only 'returned' and 'cancelled' change anything. */
export const ORDER_STATUSES = ['delivered', 'returned', 'cancelled', 'unknown'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** 'mine' goes into stock; 'return' is a gift or return, left out by default (prototype `mark`). */
export type Mark = 'mine' | 'return'

/** A category and a group in it. */
export interface Shelf {
  category: Category
  group: Group
}

// ---------- The draft ----------

/** One cleaned import row. Prototype review row, without its UI state (`inc`, `match`). */
export interface ImportDraft {
  /** Title Case, at most 80 characters, never ''. Not trimmed (prototype). */
  name: string
  /** '' when not known. */
  brand: string
  /** Free text such as "500 ml"; '' when not known. */
  size: string
  /**
   * Trimmed and lowercase, at most 20 characters, never ''. One of KNOWN_UNITS, or the person's
   * own unit such as "crate".
   */
  unit: Unit
  /** Units bought: a whole number, 1 or more. Above 99 comes with a 'count-large' warning. */
  quantity: number
  /**
   * Always a date, so the review's date picker starts filled in. Today when the row has no date
   * or an unusable one (the prototype stored '' and calcStock then used today, so stock is the same).
   */
  boughtAt: IsoDate
  /** '' when not known. */
  shop: string
  category: Category
  group: Group
  /** The source's short reason for its shelf choice (prototype `why`, from the row's `note`). */
  reason: string
  /** Up to 2 other shelves it could sit on, never the row's own shelf, no repeats. */
  alternatives: Shelf[]
  confidence: Confidence
  mark: Mark
  /** Not in the prototype's import, which never had links. Only links isSafeLink accepts. */
  links: ItemLinks
}

/** Which part of the draft an issue is about. */
export type DraftField = keyof ImportDraft | 'links.product' | 'links.brand'

/** Why a field was flagged. Two codes are shared with validateItem. */
export type ImportIssueCode =
  | Extract<IssueCode, 'invalid-date' | 'link-scheme'>
  | 'wrong-type'
  | 'too-long'
  | 'unknown-category'
  | 'unknown-group'
  | 'count-adjusted'
  | 'count-large'
  | 'date-in-future'
  | 'date-too-old'
  | 'unknown-confidence'
  | 'unknown-status'
  | 'alternative-dropped'

/**
 * 'error': the value was changed or dropped. 'warning': the value was kept as given, but looks
 * unusual and is worth checking (only 'count-large' so far).
 */
export type IssueSeverity = 'error' | 'warning'

/** ValidationIssue from validate.ts, with draft fields, import codes and a severity. */
export type ImportIssue = Omit<ValidationIssue, 'field' | 'code'> & {
  field: DraftField
  code: ImportIssueCode
  severity: IssueSeverity
}

/** Either a draft with what had to be fixed, or the reason there is no draft at all. */
export type NormRowResult =
  | { ok: true; draft: ImportDraft; issues: ImportIssue[] }
  | { ok: false; reason: 'not-an-object' | 'no-name' }

// ---------- Type guards ----------
// Each one checks a value of unknown type at run time. When it returns true, TypeScript treats the
// value as the narrower type from then on (that is what `value is ...` means).

/** A plain object such as { name: 'Soap' }: not null, not an array. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/** A real number: not NaN, not Infinity. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** True if `value` is one of the strings in `list`. Exact match: case and spaces count. */
function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return isString(value) && (list as readonly string[]).includes(value)
}

/** Missing: undefined, null or ''. Missing fields get their default without an issue. */
function isMissing(value: unknown): value is undefined | null | '' {
  return value === undefined || value === null || value === ''
}

// ---------- Text ----------

const SMALL_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'or',
  'of',
  'the',
  'in',
  'to',
  'for',
  'on',
])

/**
 * Capitalises the first letter of each word, except small words ("of", "the"...) after the start.
 * Oddities kept: other letters are left as they are ("SHAMPOO" stays "SHAMPOO"); a word is a run
 * of A-Z letters and apostrophes, so "crème" becomes "CrèMe"; and "after the start" counts
 * characters, so a leading space makes a first small word stay lowercase. Prototype `titleCase`.
 */
export function titleCase(text: string): string {
  return text.replace(/[A-Za-z][A-Za-z']*/g, (word: string, offset: number) => {
    const lower = word.toLowerCase()
    return offset > 0 && SMALL_WORDS.has(lower)
      ? lower
      : word.charAt(0).toUpperCase() + word.slice(1)
  })
}

/**
 * Lowercase, every run of characters other than a-z and 0-9 turned into one space, trimmed.
 * Oddity kept: letters outside A-Z are dropped, so "Crème" is "cr me", and a name with no Latin
 * letters or digits at all becomes ''. Prototype `norm`.
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// ---------- normRow ----------

/** Collects issues while one row is read. */
type Issues = ImportIssue[]

function addIssue(
  issues: Issues,
  field: DraftField,
  code: ImportIssueCode,
  message: string,
  severity: IssueSeverity = 'error',
): void {
  issues.push({ field, code, message, severity })
}

/**
 * Text trimmed and in lowercase (" Returned " is "returned"); anything that isn't text is
 * returned unchanged for the checks after it.
 */
function tidyWord(value: unknown): unknown {
  return isString(value) ? value.trim().toLowerCase() : value
}

/**
 * The unit, trimmed and in lowercase, so "Tube" is "tube", "jar " is "jar" and "Crate" is the
 * person's own unit "crate". Missing or only spaces gives 'bottle'. Not text gives 'bottle' with
 * an error. Longer than 20 characters is cut.
 */
function readUnit(value: unknown, issues: Issues): Unit {
  const unit = tidyWord(value)
  if (isMissing(unit)) return FALLBACK_UNIT
  if (!isString(unit)) {
    addIssue(issues, 'unit', 'wrong-type', `The unit wasn’t text, so “${FALLBACK_UNIT}” was used.`)
    return FALLBACK_UNIT
  }
  if (unit.length > TEXT_LIMITS.unit) {
    addIssue(issues, 'unit', 'too-long', `This was cut to ${TEXT_LIMITS.unit} characters.`)
    // Trim again, in case the cut ends on a space.
    return unit.slice(0, TEXT_LIMITS.unit).trimEnd()
  }
  return unit
}

/** Text that is only a whole number, with optional spaces and sign: "3", " 4 ", "-2". */
const WHOLE_NUMBER_TEXT = /^\s*[+-]?\d+\s*$/

/**
 * Text from a field: a string as it is, or a finite number written out (500 becomes "500").
 * Missing gives ''. Anything else is dropped. Text over `limit` characters is cut.
 */
function readText(value: unknown, field: DraftField, limit: number, issues: Issues): string {
  let text: string
  if (isMissing(value)) return ''
  if (isString(value)) text = value
  else if (isFiniteNumber(value)) text = String(value)
  else {
    addIssue(issues, field, 'wrong-type', 'This wasn’t text, so it was left empty.')
    return ''
  }
  if (text.length > limit) {
    addIssue(issues, field, 'too-long', `This was cut to ${limit} characters.`)
    // Oddity kept: slice counts UTF-16 units, so it can cut an emoji in half.
    return text.slice(0, limit)
  }
  return text
}

/**
 * Units bought: a number (rounded), or text read as a whole number from its start ("3" is 3,
 * "3 bottles" is 3, "2.5" is 2). Missing gives 1. Unreadable, 0 or negative gives 1 with an error.
 * Text that isn't only a whole number is reported, so "3 bottles" is but "3" isn't.
 * Counts above 99 are kept, with a warning.
 */
function readCount(value: unknown, issues: Issues): number {
  if (isMissing(value)) return MIN_COUNT
  let parsed: number
  if (isFiniteNumber(value)) parsed = value
  else if (isString(value)) parsed = Number.parseInt(value, 10)
  else parsed = Number.NaN

  // Math.round(NaN) and Math.round(0) are falsy, so both become 1 (prototype `|| 1`).
  const count = Math.max(MIN_COUNT, Math.round(parsed) || MIN_COUNT)
  if (count !== parsed) {
    addIssue(
      issues,
      'quantity',
      'count-adjusted',
      `The number bought must be a whole number, ${MIN_COUNT} or more, so it was set to ${count}.`,
    )
  } else if (isString(value) && !WHOLE_NUMBER_TEXT.test(value)) {
    addIssue(issues, 'quantity', 'count-adjusted', `“${value}” was read as ${count}.`)
  }
  if (count > EXPECTED_MAX_COUNT) {
    addIssue(
      issues,
      'quantity',
      'count-large',
      `${count} is more than usual for one order line. Check the number is right.`,
      'warning',
    )
  }
  return count
}

/**
 * A real date after 2000-01-01 and not after today. Missing gives today without an issue; anything
 * unusable gives today with an error. Prototype cleanDate (which gave '' instead of today).
 */
function readDate(value: unknown, today: IsoDate, issues: Issues): IsoDate {
  if (isMissing(value)) return today
  if (!isString(value)) {
    addIssue(
      issues,
      'boughtAt',
      'wrong-type',
      'The purchase date wasn’t text, so today’s date was used instead.',
    )
    return today
  }
  // Stricter than the prototype, whose pattern check let "2026-02-30" through.
  if (!isValidIsoDate(value)) {
    addIssue(
      issues,
      'boughtAt',
      'invalid-date',
      `The purchase date (${value}) wasn’t a real date written as YYYY-MM-DD, so today’s date was used instead.`,
    )
    return today
  }
  // "YYYY-MM-DD" strings sort in date order, so plain comparison works.
  if (value > today) {
    addIssue(
      issues,
      'boughtAt',
      'date-in-future',
      `The purchase date (${value}) is in the future, so today’s date was used instead.`,
    )
    return today
  }
  if (value <= EARLIEST_DATE_EXCLUSIVE) {
    addIssue(
      issues,
      'boughtAt',
      'date-too-old',
      `The purchase date (${value}) is before 2000, so today’s date was used instead.`,
    )
    return today
  }
  return value
}

/**
 * The row's own group. A default group of its category is kept. Otherwise: 'Other' when the
 * category itself was a fallback (the prototype's 'Other Basics'), 'Other' when the row said
 * 'Other', else the category's first default group. Exact match: case and spaces count.
 */
function resolveGroup(category: Category, value: unknown, usedFallback: boolean): Group {
  if (isOneOf(DEFAULT_GROUPS[category], value)) return value
  if (usedFallback) return FALLBACK_SHELF.group
  if (value === OTHER_GROUP) return OTHER_GROUP
  return DEFAULT_GROUPS[category][0] ?? OTHER_GROUP
}

/**
 * Up to 2 other shelves. Entries without a known category are dropped (and reported); an unknown
 * group becomes 'Other' (oddity kept: the row's own unknown group becomes the first default group
 * instead). Repeats of the row's own shelf or of an earlier entry, and entries past the second,
 * are dropped without an issue, as in the prototype.
 */
function readAlternatives(value: unknown, own: Shelf, issues: Issues): Shelf[] {
  if (isMissing(value)) return []
  if (!Array.isArray(value)) {
    addIssue(
      issues,
      'alternatives',
      'wrong-type',
      'The other shelves weren’t a list, so they were left out.',
    )
    return []
  }
  const list: readonly unknown[] = value
  const shelves: Shelf[] = []
  for (const entry of list) {
    if (shelves.length >= MAX_ALTERNATIVES) break
    if (!isRecord(entry) || !isOneOf(CATEGORIES, entry['cat'])) {
      addIssue(
        issues,
        'alternatives',
        'alternative-dropped',
        'One of the other shelves wasn’t a known shelf, so it was left out.',
      )
      continue
    }
    const category = entry['cat']
    const sub = entry['sub']
    const group = isOneOf(DEFAULT_GROUPS[category], sub) ? sub : OTHER_GROUP
    const same = (shelf: Shelf) => shelf.category === category && shelf.group === group
    if (same(own) || shelves.some(same)) continue
    shelves.push({ category, group })
  }
  return shelves
}

/** One link: kept if isSafeLink accepts it (http:// included, as in validateItem), else dropped. */
function readLink(
  value: unknown,
  field: 'links.product' | 'links.brand',
  issues: Issues,
): string | undefined {
  if (isMissing(value)) return undefined
  if (isString(value) && isSafeLink(value).ok) return value
  addIssue(
    issues,
    field,
    'link-scheme',
    'Links must be web addresses starting with http:// or https://, so this one was left out.',
  )
  return undefined
}

/**
 * Cleans one raw row into an import draft, and lists every field it had to change or drop.
 * Fields that are missing (undefined, null or '') get their default without an issue.
 * Unknown extra fields are ignored. The row is never changed.
 *
 * Expected input fields (the prototype's AI reply shape): name, brand, size, unit, count, date,
 * shop, cat, sub, status, confidence, note, alts [{cat, sub}], plus link and blink (new here).
 *
 * Returns `ok: false` when the row isn't an object, or has no usable name.
 * Call findMatch on the draft afterwards: the prototype's normRow did that itself.
 *
 * Deliberate differences from the prototype: dates must be real calendar dates (isValidIsoDate);
 * text fields accept only strings or finite numbers (the prototype turned anything into text,
 * such as "[object Object]"); a name of 0 is "0" (the prototype dropped the row); the count only
 * accepts numbers or text (the prototype read [5] as 5) and reads text as a whole number from its
 * start ("3 bottles" is 3); counts above 99 are kept with a warning (the prototype cut them to 99);
 * unit and status are trimmed and lowercased (the prototype matched them exactly), and a unit
 * Shelfie doesn't know is kept as the person's own (the prototype used 'bottle'); a missing or
 * unusable purchase date becomes today (the prototype left it out); unknown categories fall back to
 * FALLBACK_SHELF instead of 'basics'; and links are read at all.
 *
 * @throws InvalidDateError if `today` isn't a valid date.
 */
export function normRow(raw: unknown, today: IsoDate): NormRowResult {
  if (!isValidIsoDate(today)) throw new InvalidDateError(today, 'normRow')
  if (!isRecord(raw)) return { ok: false, reason: 'not-an-object' }

  const rawName = raw['name']
  if (!(isString(rawName) && rawName !== '') && !isFiniteNumber(rawName)) {
    return { ok: false, reason: 'no-name' }
  }

  const issues: Issues = []
  // Oddity kept: nothing is trimmed, so "  Soap  " keeps its spaces and "   " is a valid name.
  const name = titleCase(readText(rawName, 'name', TEXT_LIMITS.name, issues))

  const rawCategory = raw['cat']
  const knownCategory = isOneOf(CATEGORIES, rawCategory)
  const category: Category = knownCategory ? rawCategory : FALLBACK_SHELF.category
  if (!knownCategory && !isMissing(rawCategory)) {
    addIssue(
      issues,
      'category',
      'unknown-category',
      'This shelf isn’t one Shelfie knows, so a default shelf was used.',
    )
  }

  const rawGroup = raw['sub']
  const group = resolveGroup(category, rawGroup, !knownCategory)
  if (group !== rawGroup && !isMissing(rawGroup)) {
    addIssue(
      issues,
      'group',
      'unknown-group',
      `This group isn’t on the shelf, so “${group}” was used.`,
    )
  }

  const rawConfidence = raw['confidence']
  const knownConfidence = isOneOf(CONFIDENCES, rawConfidence)
  if (!knownConfidence && !isMissing(rawConfidence)) {
    addIssue(
      issues,
      'confidence',
      'unknown-confidence',
      'The confidence wasn’t high, medium or low, so medium was used.',
    )
  }

  // Matched trimmed and in lowercase, so " Returned " is "returned".
  const rawStatus = tidyWord(raw['status'])
  if (!isOneOf(ORDER_STATUSES, rawStatus) && !isMissing(rawStatus)) {
    addIssue(
      issues,
      'mark',
      'unknown-status',
      'The order status wasn’t recognised, so it counts as yours.',
    )
  }

  const links: ItemLinks = {}
  const product = readLink(raw['link'], 'links.product', issues)
  if (product !== undefined) links.product = product
  const brandLink = readLink(raw['blink'], 'links.brand', issues)
  if (brandLink !== undefined) links.brand = brandLink

  const draft: ImportDraft = {
    name,
    brand: readText(raw['brand'], 'brand', TEXT_LIMITS.brand, issues),
    size: readText(raw['size'], 'size', TEXT_LIMITS.size, issues),
    unit: readUnit(raw['unit'], issues),
    quantity: readCount(raw['count'], issues),
    boughtAt: readDate(raw['date'], today, issues),
    shop: readText(raw['shop'], 'shop', TEXT_LIMITS.shop, issues),
    category,
    group,
    reason: readText(raw['note'], 'reason', TEXT_LIMITS.reason, issues),
    alternatives: readAlternatives(raw['alts'], { category, group }, issues),
    confidence: knownConfidence ? rawConfidence : 'medium',
    mark: rawStatus === 'returned' || rawStatus === 'cancelled' ? 'return' : 'mine',
    links,
  }
  return { ok: true, draft, issues }
}

// ---------- findMatch ----------

/**
 * The first stored item the draft would top up, or undefined. Names must be equal after
 * normalizeForMatch; no fuzziness, so "Cotton Pad" and "Cotton Pads" differ. Brands must be
 * equal the same way, unless either one is empty, when the name alone decides. First in `items`
 * order wins (the prototype used storage order). Prototype `findMatch`.
 *
 * Oddities kept: a draft brand that normalises to '' (such as "!!!") counts as empty, but an item
 * brand is only empty if it is exactly ''; and names with no Latin letters or digits all
 * normalise to '', so they all match each other.
 */
export function findMatch(
  draft: Pick<ImportDraft, 'name' | 'brand'>,
  items: readonly Item[],
): Item | undefined {
  const name = normalizeForMatch(draft.name)
  const brand = normalizeForMatch(draft.brand)
  return items.find(
    (item) =>
      normalizeForMatch(item.name) === name &&
      (brand === '' || item.brand === '' || normalizeForMatch(item.brand) === brand),
  )
}

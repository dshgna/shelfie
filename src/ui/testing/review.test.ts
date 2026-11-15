// The Fill my shelves review rules (src/ui/fill/review.ts) and the mock reader
// (src/ui/fill/read-orders.ts). Invented data only.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { plusDays } from '../../domain/dates'
import { CURRENT_SCHEMA_VERSION, type Item } from '../../domain/item'
import { normRow } from '../../domain/import-rows'
import { DEFAULT_SHARE } from '../../domain/status'
import { calcStock } from '../../domain/stock'
import { TODAY, makeItem } from '../../domain/testing/helpers/fixtures'
import { guessDays } from '../../domain/typical'
import { readOrders } from '../fill/read-orders'
import {
  additionsFor,
  applyEdit,
  doneText,
  editorValues,
  estimate,
  estimateText,
  isAdded,
  matchFor,
  moveTo,
  resetLife,
  rowsFromReply,
  shelfChoices,
  typicalLife,
  type ReviewRow,
} from '../fill/review'

/** One raw row as the reader returns it. */
function raw(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Lemon Washing-Up Liquid',
    brand: 'Brightwell',
    size: '500 ml',
    unit: 'bottle',
    count: 2,
    date: plusDays(TODAY, -5),
    shop: 'Corner Shop',
    cat: 'kitchen',
    sub: 'Dishwashing',
    status: 'delivered',
    confidence: 'high',
    ...overrides,
  }
}

function row(overrides: Record<string, unknown> = {}): ReviewRow {
  const [first] = rowsFromReply({ rows: [raw(overrides)] }, TODAY)
  if (!first) throw new Error('expected a row')
  return first
}

let next = 0
const ids = () => ({ item: () => `item-${(next += 1)}`, purchase: () => `purchase-${(next += 1)}` })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rowsFromReply', () => {
  it('keeps the rows normRow can read, ticked, and drops the rest', () => {
    const rows = rowsFromReply(
      { rows: [raw(), 'not a row', { brand: 'No name' }, raw({ name: 'Sponges' })] },
      TODAY,
    )
    expect(rows.map((r) => r.draft.name)).toEqual(['Lemon Washing-Up Liquid', 'Sponges'])
    expect(rows.every((r) => r.include)).toBe(true)
    expect(new Set(rows.map((r) => r.key)).size).toBe(2)
  })

  it("uses normRow's draft, so returned rows are marked as gifts or returns", () => {
    expect(row({ status: 'returned' }).draft.mark).toBe('return')
    expect(row().draft.mark).toBe('mine')
    expect(row().draft).toEqual((normRow(raw(), TODAY) as { ok: true; draft: unknown }).draft)
  })

  it('remembers the shelves the reader offered: its choice, then the alternatives', () => {
    const r = row({ confidence: 'low', alts: [{ cat: 'hair', sub: 'Body Soap' }] })
    expect(r.offered).toEqual([
      { category: 'kitchen', group: 'Dishwashing' },
      { category: 'hair', group: 'Body Soap' },
    ])
  })
})

describe('estimates', () => {
  it("is calcStock's estimate, with the typical lifetime unless the person changed it", () => {
    const r = row({ count: 3, date: plusDays(TODAY, -70) })
    const typical = guessDays('Lemon Washing-Up Liquid', '500 ml', 'bottle', 'kitchen')
    expect(typicalLife(r)).toBe(typical)
    expect(estimate(r, TODAY)).toEqual(
      calcStock(
        {
          quantity: 3,
          boughtAt: plusDays(TODAY, -70),
          size: '500 ml',
          unit: 'bottle',
          name: 'Lemon Washing-Up Liquid',
          category: 'kitchen',
        },
        TODAY,
      ),
    )
    expect(estimate({ ...r, lifeOverride: 30 }, TODAY)).toMatchObject({ lifeDays: 30, left: 1 })
  })

  it.each([
    { count: 1, daysAgo: 0, life: 30, text: 'Unused so far' },
    { count: 3, daysAgo: 0, life: 30, text: 'All 3 unused so far' },
    { count: 3, daysAgo: 45, life: 30, text: 'About 2 of 3 left' },
    { count: 2, daysAgo: 90, life: 30, text: 'Probably all used up' },
  ])('says "$text"', ({ count, daysAgo, life, text }) => {
    const r = { ...row({ count, date: plusDays(TODAY, -daysAgo) }), lifeOverride: life }
    expect(estimateText(r, TODAY)).toBe(text)
  })
})

describe('isAdded and matchFor', () => {
  it('adds only ticked rows that are not a gift or return', () => {
    expect(isAdded(row())).toBe(true)
    expect(isAdded({ ...row(), include: false })).toBe(false)
    expect(isAdded(row({ status: 'returned' }))).toBe(false)
  })

  it("finds the stored item with the domain's findMatch", () => {
    const stored = makeItem({ id: 'soap', name: 'Lemon Washing-up liquid', brand: 'Brightwell' })
    expect(matchFor(row(), [makeItem({ id: 'other' }), stored])?.id).toBe('soap')
    expect(matchFor(row({ brand: 'Another Brand' }), [stored])).toBeUndefined()
  })
})

describe('shelf choices', () => {
  const unsure = () => row({ confidence: 'low', alts: [{ cat: 'hair', sub: 'Body Soap' }] })

  it('offers the same chips after picking one, with no shelf twice', () => {
    const moved = moveTo(unsure(), { category: 'hair', group: 'Body Soap' })
    expect(moved.draft).toMatchObject({ category: 'hair', group: 'Body Soap' })
    expect(shelfChoices(moved)).toEqual([
      { category: 'kitchen', group: 'Dishwashing' },
      { category: 'hair', group: 'Body Soap' },
    ])
  })

  it('adds the shelf picked in the editor when it is a new one', () => {
    const moved = moveTo(unsure(), { category: 'laundry', group: 'Washing' })
    expect(shelfChoices(moved)).toEqual([
      { category: 'kitchen', group: 'Dishwashing' },
      { category: 'hair', group: 'Body Soap' },
      { category: 'laundry', group: 'Washing' },
    ])
  })
})

describe('editing a row', () => {
  it('starts with the row, days showing the estimate in use', () => {
    const r = row()
    expect(editorValues(r, TODAY)).toEqual({
      name: 'Lemon Washing-Up Liquid',
      brand: 'Brightwell',
      size: '500 ml',
      count: '2',
      bought: plusDays(TODAY, -5),
      category: 'kitchen',
      group: 'Dishwashing',
      days: String(typicalLife(r)),
    })
  })

  it('applies the values, trimmed', () => {
    const r = row()
    const result = applyEdit(
      r,
      {
        ...editorValues(r, TODAY),
        name: '  Lime Soap  ',
        brand: ' Fernleaf ',
        count: '4',
        bought: plusDays(TODAY, -2),
        category: 'hair',
        group: 'Hand Soap',
      },
      TODAY,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.row.draft).toMatchObject({
        name: 'Lime Soap',
        brand: 'Fernleaf',
        quantity: 4,
        boughtAt: plusDays(TODAY, -2),
        category: 'hair',
        group: 'Hand Soap',
      })
      expect(result.row.key).toBe(r.key)
    }
  })

  it('reports every problem next to its field, with the domain messages', () => {
    const r = row()
    const result = applyEdit(
      r,
      { ...editorValues(r, TODAY), name: ' ', count: '0', bought: '2026-02-30', days: '1.5' },
      TODAY,
    )
    expect(result).toEqual({
      ok: false,
      errors: {
        fields: {
          name: 'Enter a name for the item.',
          count: 'This must be a whole number, 1 or more.',
          bought: 'This must be a real date written as YYYY-MM-DD, for example 2026-11-14.',
          days: 'This must be a whole number, 0 or more.',
        },
        other: [],
      },
    })
  })

  it('treats a blank bought date as today', () => {
    const r = row()
    const result = applyEdit(r, { ...editorValues(r, TODAY), bought: '' }, TODAY)
    expect(result.ok && result.row.draft.boughtAt).toBe(TODAY)
  })

  it('keeps the typical estimate when days are left as shown, and uses changed days', () => {
    const r = row()
    const same = applyEdit(r, editorValues(r, TODAY), TODAY)
    expect(same.ok && 'lifeOverride' in same.row).toBe(false)
    const changed = applyEdit(r, { ...editorValues(r, TODAY), days: '120' }, TODAY)
    expect(changed.ok && changed.row.lifeOverride).toBe(120)
  })

  it.each(['', '0'])('goes back to the typical estimate for days "%s"', (days) => {
    const r = { ...row(), lifeOverride: 120 }
    const result = applyEdit(r, { ...editorValues(r, TODAY), days }, TODAY)
    expect(result.ok && 'lifeOverride' in result.row).toBe(false)
  })

  it('Use typical drops the edited days', () => {
    expect('lifeOverride' in resetLife({ ...row(), lifeOverride: 120 })).toBe(false)
  })
})

describe('additionsFor', () => {
  it('turns a new row into a new item and its purchase record', () => {
    const r = {
      ...row({ count: 3, date: plusDays(TODAY, -70), link: 'https://shop.example/soap' }),
      lifeOverride: 30,
    }
    const { additions, skipped } = additionsFor([r], [], 'home', TODAY, ids())
    expect(skipped).toEqual([])
    expect(additions).toHaveLength(1)
    const [added] = additions
    expect(added?.topsUp).toBeUndefined()
    expect(added?.item).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      householdId: 'home',
      name: 'Lemon Washing-Up Liquid',
      category: 'kitchen',
      group: 'Dishwashing',
      quantity: 1,
      lifeDays: 30,
      startedOn: plusDays(TODAY, -10),
      reorder: { kind: 'share', share: DEFAULT_SHARE },
      buyUpTo: 1,
      location: '',
      notes: `Imported from Corner Shop, bought ${plusDays(TODAY, -70)}`,
      link: 'https://shop.example/soap',
      isExample: false,
      deleted: false,
    })
    expect(added?.purchase).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: added?.purchase.id,
      itemId: added?.item.id,
      quantity: 3,
      size: '500 ml',
      unit: 'bottle',
      boughtAt: plusDays(TODAY, -70),
    })
  })

  it('aims to keep 2 of units bought in packs, 1 of a bottle, tube or bar', () => {
    const { additions } = additionsFor(
      [row({ name: 'Sponges', unit: 'sponge' }), row({ name: 'Soap Bar', unit: 'bar' })],
      [],
      'home',
      TODAY,
      ids(),
    )
    expect(additions.map((a) => a.item.buyUpTo)).toEqual([2, 1])
  })

  it('leaves out unticked rows and gifts or returns', () => {
    const rows = [
      { ...row({ name: 'A' }), include: false },
      row({ name: 'B', status: 'returned' }),
      row({ name: 'C' }),
    ]
    expect(additionsFor(rows, [], 'home', TODAY, ids()).additions.map((a) => a.item.name)).toEqual([
      'C',
    ])
  })

  it('tops up a matching item: more stock, a new purchase record, its own lifetime kept', () => {
    const stored = makeItem({
      id: 'soap',
      name: 'Lemon Washing-Up Liquid',
      brand: 'Brightwell',
      quantity: 1,
      lifeDays: 40,
      startedOn: plusDays(TODAY, -3),
      reorder: { kind: 'share', share: 0.9 },
    })
    const { additions } = additionsFor([row()], [stored], 'home', TODAY, ids())
    expect(additions[0]?.topsUp).toBe('Lemon Washing-Up Liquid')
    expect(additions[0]?.item).toMatchObject({
      id: 'soap',
      quantity: 3,
      lifeDays: 40,
      startedOn: plusDays(TODAY, -3),
    })
    expect('updatedAt' in (additions[0]?.item ?? {})).toBe(false)
    expect(additions[0]?.purchase).toMatchObject({ itemId: 'soap', quantity: 2 })
  })

  it('gives a topped-up item a lifetime and start date when it had none or was out', () => {
    const stored = makeItem({ id: 'soap', name: 'Lemon Washing-Up Liquid', brand: '', quantity: 0 })
    const r = row({ date: plusDays(TODAY, -5) })
    const { additions } = additionsFor([r], [stored], 'home', TODAY, ids())
    const stock = estimate(r, TODAY)
    expect(additions[0]?.item).toMatchObject({
      quantity: stock.left,
      lifeDays: stock.lifeDays,
      startedOn: stock.startedOn,
    })
  })

  it('adds up two rows that top up the same item', () => {
    const stored = makeItem({ id: 'soap', name: 'Lemon Washing-Up Liquid', brand: '', quantity: 1 })
    const { additions } = additionsFor(
      [row({ count: 2 }), row({ count: 3 })],
      [stored],
      'home',
      TODAY,
      ids(),
    )
    expect(additions.map((a) => a.item.quantity)).toEqual([3, 6])
    expect(additions.every((a) => a.item.id === 'soap')).toBe(true)
  })

  it('never changes the stored items it is given', () => {
    const stored = makeItem({ id: 'soap', name: 'Lemon Washing-Up Liquid', brand: '', quantity: 1 })
    const before = structuredClone(stored)
    additionsFor([row()], [stored], 'home', TODAY, ids())
    expect(stored).toEqual(before)
  })

  it('skips a row that would save an invalid item, instead of saving it', () => {
    const broken: Item = makeItem({
      id: 'old',
      name: 'Lemon Washing-Up Liquid',
      brand: '',
      buyUpTo: 1.5,
    })
    const r = row()
    const { additions, skipped } = additionsFor(
      [r, row({ name: 'Sponges' })],
      [broken],
      'home',
      TODAY,
      ids(),
    )
    expect(skipped).toEqual([r])
    expect(additions.map((a) => a.item.name)).toEqual(['Sponges'])
  })
})

describe('doneText', () => {
  it.each([
    [
      3,
      1,
      1,
      '2 new items added to your shelves. 1 item you already had topped up. 1 left out as a gift, a return or unticked.',
    ],
    [1, 0, 0, '1 new item added to your shelves.'],
    [2, 2, 2, '2 items you already had topped up. 2 left out as gifts, returns or unticked.'],
    [0, 0, 3, '3 left out as gifts, returns or unticked.'],
    [0, 0, 0, 'Nothing was added.'],
  ] as const)('added %i, topped up %i, left out %i', (added, toppedUp, leftOut, text) => {
    expect(doneText(added, toppedUp, leftOut)).toBe(text)
  })
})

describe('readOrders (mock)', () => {
  it('returns rows that normRow reads, without touching the network', async () => {
    const fetch = vi.fn(() => {
      throw new Error('no network')
    })
    vi.stubGlobal('fetch', fetch)
    const reply = await readOrders('Invented order text')
    expect(reply.rows.length).toBeGreaterThan(0)
    expect(reply.rows.every((r) => normRow(r, TODAY).ok)).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('includes a gift or return and an unsure row, so the review shows both', async () => {
    const rows = rowsFromReply(await readOrders(''), TODAY)
    expect(rows.some((r) => r.draft.mark === 'return')).toBe(true)
    expect(rows.some((r) => r.draft.confidence !== 'high' && r.draft.alternatives.length > 0)).toBe(
      true,
    )
  })
})

import { describe, expect, it } from 'vitest'
import { InvalidDateError } from '../dates'
import { CURRENT_SCHEMA_VERSION, type Item } from '../item'
import {
  CURRENT_VERSION,
  MIGRATIONS,
  MigrationError,
  RemovedItem,
  VERSIONS,
  migrateToCurrent,
  versionOf,
  type MigrationErrorCode,
  type MigrationStep,
  type StoredVersion,
} from '../migrations'

// Invented example data, not anyone's real inventory.

const TODAY = '2026-11-14'
const context = { today: TODAY, householdId: 'test-household' }

type Raw = Record<string, unknown>

/** Freezes an object and everything inside it, so any attempt to change it throws. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function stepFrom(from: StoredVersion): MigrationStep {
  const step = MIGRATIONS.find((s) => s.from === from)
  if (!step) throw new Error(`No step from ${from}`)
  return step
}

function expectMigrationError(run: () => unknown, code: MigrationErrorCode): MigrationError {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(MigrationError)
    if (!(error instanceof MigrationError)) throw error
    expect(error.code).toBe(code)
    return error
  }
  throw new Error(`Expected a MigrationError with code ${code}, but nothing was thrown`)
}

/** A complete, valid item at the current version. */
function currentItem(overrides: Partial<Item> = {}): Item {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'cur-1',
    name: 'Rosemary Shampoo',
    brand: 'Example Botanics',
    category: 'hair',
    group: 'Shampoo',
    location: 'Shower caddy',
    quantity: 1,
    unit: 'bottle',
    size: '250 ml',
    lifeDays: 50,
    startedOn: '2026-10-01',
    reorder: { kind: 'share', share: 0.9 },
    buyUpTo: 2,
    notes: '',
    links: { product: 'https://shop.example/rosemary' },
    isExample: false,
    householdId: 'test-household',
    deleted: false,
    ...overrides,
  }
}

/** A complete prototype v6 item, as the prototype's form writes it. */
function v6Item(overrides: Raw = {}): Raw {
  return {
    id: 'v6-1',
    name: 'Cedar Shampoo',
    cat: 'hair',
    sub: 'Shampoo',
    loc: 'Shower caddy',
    qty: 2,
    unit: 'bottle',
    min: 0,
    par: 2,
    expiry: '2027-06-01',
    note: 'Sulphate free',
    example: false,
    v: 6,
    brand: 'Examplehill',
    size: '250 ml',
    life: 50,
    start: '2026-10-20',
    pct: 0.75,
    link: 'https://shop.example/cedar',
    blink: 'https://shop.example/examplehill',
    ...overrides,
  }
}

describe('the chain', () => {
  it('climbs every version in order, one rung per step, ending at the current version', () => {
    expect(MIGRATIONS.map((step) => step.from)).toEqual(VERSIONS.slice(0, -1))
    expect(MIGRATIONS.map((step) => step.to)).toEqual(VERSIONS.slice(1))
    expect(VERSIONS.at(-1)).toBe(CURRENT_VERSION)
    expect(CURRENT_VERSION).toBe(`schema-${CURRENT_SCHEMA_VERSION}`)
  })
})

interface StepCase {
  name: string
  from: StoredVersion
  input: Raw
  expected: unknown
}

const v1 = { loc: 'Cupboard', qty: 1, min: 1, par: 2, expiry: '', note: '', v: 1 }

const stepCases: StepCase[] = [
  // prototype v1 → v2: the three old categories become ten
  {
    name: 'cleaning › Kitchen washing-up liquid moves to kitchen › Dishwashing',
    from: 'prototype-v1',
    input: {
      ...v1,
      id: 'a',
      name: 'Lemon Washing-up Liquid',
      cat: 'cleaning',
      sub: 'Kitchen',
      unit: 'bottle',
    },
    expected: {
      ...v1,
      id: 'a',
      name: 'Lemon Washing-up Liquid',
      cat: 'kitchen',
      sub: 'Dishwashing',
      unit: 'bottle',
      v: 2,
    },
  },
  {
    name: 'essentials › Paper Goods toilet roll moves to bathroom › Toilet Paper',
    from: 'prototype-v1',
    input: {
      ...v1,
      id: 'b',
      name: 'Recycled toilet roll',
      cat: 'essentials',
      sub: 'Paper Goods',
      unit: 'roll',
    },
    expected: {
      ...v1,
      id: 'b',
      name: 'Recycled toilet roll',
      cat: 'bathroom',
      sub: 'Toilet Paper',
      unit: 'roll',
      v: 2,
    },
  },
  {
    name: 'beauty › Skincare toner is sorted into routine step 3',
    from: 'prototype-v1',
    input: {
      ...v1,
      id: 'c',
      name: 'Calendula toner',
      cat: 'beauty',
      sub: 'Skincare',
      unit: 'bottle',
    },
    expected: {
      ...v1,
      id: 'c',
      name: 'Calendula toner',
      cat: 'skincare',
      sub: 'Step 3 · Toner',
      unit: 'bottle',
      v: 2,
    },
  },
  {
    name: 'essentials batteries move to basics › Batteries & Bulbs',
    from: 'prototype-v1',
    input: {
      ...v1,
      id: 'd',
      name: 'Torch batteries',
      cat: 'essentials',
      sub: 'Household basics',
      unit: 'battery',
    },
    expected: {
      ...v1,
      id: 'd',
      name: 'Torch batteries',
      cat: 'basics',
      sub: 'Batteries & Bulbs',
      unit: 'battery',
      v: 2,
    },
  },
  {
    name: 'an item without v, already in a new category, only gets v: 2',
    from: 'prototype-v1',
    input: {
      id: 'e',
      name: 'Sponges',
      cat: 'kitchen',
      sub: 'Dishwashing',
      unit: 'pack',
      qty: 3,
      min: 1,
      par: 4,
    },
    expected: {
      id: 'e',
      name: 'Sponges',
      cat: 'kitchen',
      sub: 'Dishwashing',
      unit: 'pack',
      qty: 3,
      min: 1,
      par: 4,
      v: 2,
    },
  },

  // prototype v2 → v3: group names
  {
    name: 'hair › "Bath & shower" shower gel becomes Body Soap',
    from: 'prototype-v2',
    input: { id: 'f', name: 'Fig shower gel', cat: 'hair', sub: 'Bath & shower', v: 2 },
    expected: { id: 'f', name: 'Fig shower gel', cat: 'hair', sub: 'Body Soap', v: 3 },
  },
  {
    name: 'hair hand wash with no group becomes Hand Soap',
    from: 'prototype-v2',
    input: { id: 'g', name: 'Peppermint hand wash', cat: 'hair', sub: '', v: 2 },
    expected: { id: 'g', name: 'Peppermint hand wash', cat: 'hair', sub: 'Hand Soap', v: 3 },
  },
  {
    name: 'beauty › Bodycare becomes Body Creams',
    from: 'prototype-v2',
    input: { id: 'h', name: 'Oat body butter', cat: 'beauty', sub: 'Bodycare', v: 2 },
    expected: { id: 'h', name: 'Oat body butter', cat: 'beauty', sub: 'Body Creams', v: 3 },
  },
  {
    name: 'other groups are put in Title Case, small words kept lower case',
    from: 'prototype-v2',
    input: { id: 'i', name: 'Compost bags', cat: 'kitchen', sub: 'waste and paper', v: 2 },
    expected: { id: 'i', name: 'Compost bags', cat: 'kitchen', sub: 'Waste and Paper', v: 3 },
  },

  // prototype v3 → v4: bottles, tubes and bars reorder at 10% left
  {
    name: 'a bottle with no lifetime gets a guessed one (250 ml shampoo = 50 days) and starts today',
    from: 'prototype-v3',
    input: {
      id: 'j',
      name: 'Rosemary Shampoo',
      cat: 'hair',
      unit: 'bottle',
      size: '250 ml',
      qty: 2,
      min: 1,
      v: 3,
    },
    expected: {
      id: 'j',
      name: 'Rosemary Shampoo',
      cat: 'hair',
      unit: 'bottle',
      size: '250 ml',
      qty: 2,
      min: 0,
      pct: 0.9,
      life: 50,
      start: TODAY,
      v: 4,
    },
  },
  {
    name: 'a tube keeps its own lifetime and start date',
    from: 'prototype-v3',
    input: {
      id: 'k',
      name: 'Mint toothpaste',
      cat: 'dental',
      unit: 'tube',
      qty: 1,
      min: 1,
      life: 40,
      start: '2026-10-01',
      pct: 0.5,
      v: 3,
    },
    expected: {
      id: 'k',
      name: 'Mint toothpaste',
      cat: 'dental',
      unit: 'tube',
      qty: 1,
      min: 0,
      life: 40,
      start: '2026-10-01',
      pct: 0.9,
      v: 4,
    },
  },
  {
    name: 'a bar that is out of stock loses its start date',
    from: 'prototype-v3',
    input: {
      id: 'l',
      name: 'Olive soap bar',
      cat: 'hair',
      unit: 'bar',
      qty: 0,
      min: 1,
      start: '2026-09-01',
      v: 3,
    },
    expected: {
      id: 'l',
      name: 'Olive soap bar',
      cat: 'hair',
      unit: 'bar',
      qty: 0,
      min: 0,
      pct: 0.9,
      life: 50,
      start: '',
      v: 4,
    },
  },
  {
    name: 'a jar is left alone: no lifetime, size or start is added',
    from: 'prototype-v3',
    input: { id: 'm', name: 'Clay face mask', cat: 'skincare', unit: 'jar', qty: 1, min: 1, v: 3 },
    expected: {
      id: 'm',
      name: 'Clay face mask',
      cat: 'skincare',
      unit: 'jar',
      qty: 1,
      min: 1,
      v: 4,
    },
  },

  // prototype v4 → v5: nothing but the version
  {
    name: 'only the version changes',
    from: 'prototype-v4',
    input: {
      id: 'n',
      name: 'Bamboo toothbrush',
      cat: 'dental',
      unit: 'piece',
      qty: 2,
      min: 1,
      v: 4,
    },
    expected: {
      id: 'n',
      name: 'Bamboo toothbrush',
      cat: 'dental',
      unit: 'piece',
      qty: 2,
      min: 1,
      v: 5,
    },
  },

  // prototype v5 → v6
  {
    name: 'a missing brand becomes ""',
    from: 'prototype-v5',
    input: { id: 'o', name: 'Cotton buds', cat: 'beauty', unit: 'box', qty: 1, min: 1, v: 5 },
    expected: {
      id: 'o',
      name: 'Cotton buds',
      cat: 'beauty',
      unit: 'box',
      qty: 1,
      min: 1,
      brand: '',
      v: 6,
    },
  },
  {
    name: 'a bottle still without a lifetime gets the 10% rule',
    from: 'prototype-v5',
    input: {
      id: 'p',
      name: 'Lavender body wash',
      cat: 'hair',
      unit: 'bottle',
      qty: 1,
      min: 1,
      brand: 'Examplefield',
      v: 5,
    },
    expected: {
      id: 'p',
      name: 'Lavender body wash',
      cat: 'hair',
      unit: 'bottle',
      qty: 1,
      min: 0,
      pct: 0.9,
      life: 50,
      start: TODAY,
      brand: 'Examplefield',
      v: 6,
    },
  },
  {
    name: 'a bottle with a lifetime keeps its own rule',
    from: 'prototype-v5',
    input: {
      id: 'q',
      name: 'Lavender body wash',
      cat: 'hair',
      unit: 'bottle',
      qty: 1,
      min: 1,
      life: 30,
      brand: 'Examplefield',
      v: 5,
    },
    expected: {
      id: 'q',
      name: 'Lavender body wash',
      cat: 'hair',
      unit: 'bottle',
      qty: 1,
      min: 1,
      life: 30,
      brand: 'Examplefield',
      v: 6,
    },
  },
  {
    name: 'a sheet mask in Sleeping Mask that is not an example is kept',
    from: 'prototype-v5',
    input: {
      id: 'r',
      name: 'Sheet masks',
      cat: 'skincare',
      sub: 'Sleeping Mask',
      unit: 'pack',
      example: false,
      v: 5,
    },
    expected: {
      id: 'r',
      name: 'Sheet masks',
      cat: 'skincare',
      sub: 'Sleeping Mask',
      unit: 'pack',
      example: false,
      brand: '',
      v: 6,
    },
  },

  // prototype v6 → schemaVersion 1
  {
    name: 'a complete v6 item is renamed field by field',
    from: 'prototype-v6',
    input: v6Item(),
    expected: {
      schemaVersion: 1,
      id: 'v6-1',
      name: 'Cedar Shampoo',
      brand: 'Examplehill',
      category: 'hair',
      group: 'Shampoo',
      location: 'Shower caddy',
      quantity: 2,
      unit: 'bottle',
      size: '250 ml',
      lifeDays: 50,
      startedOn: '2026-10-20',
      reorder: { kind: 'share', share: 0.75 },
      buyUpTo: 2,
      expiresOn: '2027-06-01',
      notes: 'Sulphate free',
      links: { product: 'https://shop.example/cedar', brand: 'https://shop.example/examplehill' },
      isExample: false,
      householdId: 'test-household',
      deleted: false,
    } satisfies Item,
  },
  {
    name: 'a v6 item lacking brand, size, life, start, pct, link, blink and example gets defaults',
    from: 'prototype-v6',
    input: {
      id: 'v6-2',
      name: 'Cotton pads',
      cat: 'beauty',
      sub: 'Tools & Accessories',
      loc: '',
      qty: 3,
      unit: 'pack',
      min: 1,
      par: 2,
      expiry: '',
      note: '',
      v: 6,
    },
    expected: {
      schemaVersion: 1,
      id: 'v6-2',
      name: 'Cotton pads',
      brand: '',
      category: 'beauty',
      group: 'Tools & Accessories',
      location: '',
      quantity: 3,
      unit: 'pack',
      size: '',
      reorder: { kind: 'count', atOrBelow: 1 },
      buyUpTo: 2,
      notes: '',
      links: {},
      isExample: false,
      householdId: 'test-household',
      deleted: false,
    } satisfies Item,
  },
  {
    name: 'basics moves to household and keeps its group',
    from: 'prototype-v6',
    input: v6Item({
      cat: 'basics',
      sub: 'Batteries & Bulbs',
      unit: 'battery',
      min: 2,
      life: 0,
      start: '',
      pct: 0.5,
    }),
    expected: expect.objectContaining({
      category: 'household',
      group: 'Batteries & Bulbs',
      reorder: { kind: 'count', atOrBelow: 2 },
    }),
  },
  {
    name: 'min 0 with a lifetime and no pct reorders at half, as the prototype timed it',
    from: 'prototype-v6',
    input: v6Item({ pct: undefined }),
    expected: expect.objectContaining({ reorder: { kind: 'share', share: 0.5 }, lifeDays: 50 }),
  },
  {
    name: 'the legacy full field is dropped, brand link and all',
    from: 'prototype-v6',
    input: v6Item({
      blink: '',
      full: 'Cedar Shampoo [Examplehill](https://shop.example/examplehill)',
    }),
    expected: expect.objectContaining({ links: { product: 'https://shop.example/cedar' } }),
  },
]

describe('each step', () => {
  it.each(stepCases)('$from: $name', ({ from, input, expected }) => {
    const frozen = deepFreeze(structuredCloneJson(input))
    const output = stepFrom(from).migrate(frozen, context)
    expect(output).toStrictEqual(expected)
    expect(frozen).toStrictEqual(structuredCloneJson(input))
  })

  it('prototype-v6: min 0 without a lifetime gives a count rule at 0', () => {
    const output = stepFrom('prototype-v6').migrate(v6Item({ life: 0, start: '' }), context)
    expect(output).toMatchObject({ reorder: { kind: 'count', atOrBelow: 0 } })
    expect(output).not.toHaveProperty('startedOn')
  })

  it('prototype-v5: an example sheet mask in Sleeping Mask is removed', () => {
    const input = {
      id: 's',
      name: 'Sheet masks (5 pack)',
      cat: 'skincare',
      sub: 'Sleeping Mask',
      example: true,
      v: 5,
    }
    expect(stepFrom('prototype-v5').migrate(input, context)).toBeInstanceOf(RemovedItem)
  })
})

describe('where the sheet-mask check runs', () => {
  // The prototype checks each item as stored, before any change. Shelfie checks at the v5 → v6
  // step, after v1 → v2 and v2 → v3 may have renamed the group. `prototype` records what the
  // prototype does with the same item; the last two rows are where the two differ.
  const mask = { name: 'Sheet masks', qty: 5, unit: 'sheet', min: 1, par: 5 }
  it.each<[string, Raw, 'removed' | 'kept', 'removed' | 'kept']>([
    [
      'v3 example in Sleeping Mask',
      { ...mask, cat: 'skincare', sub: 'Sleeping Mask', example: true, v: 3 },
      'removed',
      'removed',
    ],
    [
      'v5 example in Sleeping Mask',
      { ...mask, cat: 'skincare', sub: 'Sleeping Mask', example: true, v: 5 },
      'removed',
      'removed',
    ],
    [
      'v6 example in Sleeping Mask (already migrated)',
      { ...mask, cat: 'skincare', sub: 'Sleeping Mask', example: true, v: 6 },
      'kept',
      'kept',
    ],
    [
      'v4 own item in Sleeping Mask (not an example)',
      { ...mask, cat: 'skincare', sub: 'Sleeping Mask', example: false, v: 4 },
      'kept',
      'kept',
    ],
    [
      'v1 example in beauty › Skincare (sorted into Eye Cream)',
      { ...mask, cat: 'beauty', sub: 'Skincare', example: true, v: 1 },
      'kept',
      'kept',
    ],
    [
      'v1 example in beauty › "Sleeping mask" (lower-case m)',
      { ...mask, cat: 'beauty', sub: 'Sleeping mask', example: true, v: 1 },
      'removed',
      'kept',
    ],
    [
      'v2 example in skincare › "sleeping mask"',
      { ...mask, cat: 'skincare', sub: 'sleeping mask', example: true, v: 2 },
      'removed',
      'kept',
    ],
  ])('%s: Shelfie %s, prototype %s', (_label, item, shelfie) => {
    const result = migrateToCurrent({ mask: { ...item, id: 'mask' } }, context)
    expect(result.removed.length === 1 ? 'removed' : 'kept').toBe(shelfie)
  })
})

/** A copy through JSON, which is also how stored data arrives. Drops undefined fields. */
function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('versionOf', () => {
  it.each<[unknown, StoredVersion]>([
    [{ name: 'No version at all' }, 'prototype-v1'],
    [{ v: 1 }, 'prototype-v1'],
    [{ v: 3 }, 'prototype-v3'],
    [{ v: 6 }, 'prototype-v6'],
    [{ schemaVersion: 1 }, 'schema-1'],
  ])('%j is %s', (input, expected) => {
    expect(versionOf(input)).toBe(expected)
  })

  it.each<[unknown, MigrationErrorCode]>([
    [{ v: 7 }, 'newer-version'],
    [{ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, 'newer-version'],
    [{ v: 0 }, 'unknown-version'],
    [{ v: 2.5 }, 'unknown-version'],
    [{ v: '3' }, 'unknown-version'],
    [{ v: null }, 'unknown-version'],
    [{ schemaVersion: 0 }, 'unknown-version'],
    [{ v: 6, schemaVersion: 1 }, 'unknown-version'],
    ['an item', 'not-an-item'],
  ])('%j throws %s', (input, code) => {
    expectMigrationError(() => versionOf(input), code)
  })
})

describe('migrateToCurrent', () => {
  it('takes the oldest items all the way to the current version', () => {
    const stored = {
      // No v at all: counts as prototype v1.
      'old-a': {
        id: 'old-a',
        name: 'Beeswax lip balm',
        cat: 'beauty',
        sub: 'Lips',
        loc: 'Handbag',
        qty: 1,
        unit: 'jar',
        min: 0,
        par: 1,
        expiry: '',
        note: '',
      },
      'old-b': {
        id: 'old-b',
        name: 'Pine floor cleaner',
        cat: 'cleaning',
        sub: 'Floors',
        loc: 'Utility cupboard',
        qty: 2,
        unit: 'bottle',
        min: 1,
        par: 2,
        expiry: '',
        note: '',
        v: 1,
      },
    }
    expect(migrateToCurrent(stored, context)).toStrictEqual({
      items: [
        {
          from: 'prototype-v1',
          issues: [],
          item: {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            id: 'old-a',
            name: 'Beeswax lip balm',
            brand: '',
            category: 'beauty',
            group: 'Lips',
            location: 'Handbag',
            quantity: 1,
            unit: 'jar',
            size: '',
            reorder: { kind: 'count', atOrBelow: 0 },
            buyUpTo: 1,
            notes: '',
            links: {},
            isExample: false,
            householdId: 'test-household',
            deleted: false,
          },
        },
        {
          from: 'prototype-v1',
          issues: [],
          item: {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            id: 'old-b',
            name: 'Pine floor cleaner',
            brand: '',
            category: 'household',
            group: 'Floors, Surfaces & Cloths',
            location: 'Utility cupboard',
            quantity: 2,
            unit: 'bottle',
            size: '',
            // "floor cleaner" with no size: the typical 60 days, started today, 10% rule.
            lifeDays: 60,
            startedOn: TODAY,
            reorder: { kind: 'share', share: 0.9 },
            buyUpTo: 2,
            notes: '',
            links: {},
            isExample: false,
            householdId: 'test-household',
            deleted: false,
          },
        },
      ],
      removed: [],
    })
  })

  it('gives very old items sensible defaults for size, life, start, pct, link and blink', () => {
    const old = {
      name: 'x',
      cat: 'kitchen',
      sub: 'Dishwashing',
      loc: '',
      min: 1,
      par: 2,
      expiry: '',
      note: '',
      v: 1,
    }
    const { items } = migrateToCurrent(
      [
        { ...old, id: 'brush', name: 'Dish brush', unit: 'brush', qty: 1 },
        {
          ...old,
          id: 'tube',
          name: 'Hand cream',
          cat: 'beauty',
          sub: 'Body Creams',
          unit: 'tube',
          qty: 1,
        },
        { ...old, id: 'empty-bottle', name: 'Dish soap', unit: 'bottle', qty: 0 },
      ],
      context,
    )
    const byId = new Map(items.map(({ item }) => [item.id, item]))

    // Not a bottle, tube or bar: nothing to time, so no lifetime or start; the count rule stays.
    expect(byId.get('brush')).toMatchObject({
      size: '',
      links: {},
      reorder: { kind: 'count', atOrBelow: 1 },
    })
    expect(byId.get('brush')).not.toHaveProperty('lifeDays')
    expect(byId.get('brush')).not.toHaveProperty('startedOn')

    // A tube: typical hand cream lifetime (30 days), started today, reorder at 10% left.
    expect(byId.get('tube')).toMatchObject({
      size: '',
      lifeDays: 30,
      startedOn: TODAY,
      reorder: { kind: 'share', share: 0.9 },
      links: {},
    })

    // A bottle with none in stock: a lifetime but no start date.
    expect(byId.get('empty-bottle')).toMatchObject({
      lifeDays: 50,
      reorder: { kind: 'share', share: 0.9 },
    })
    expect(byId.get('empty-bottle')).not.toHaveProperty('startedOn')

    expect(items.every(({ issues }) => issues.length === 0)).toBe(true)
  })

  it('returns an already-current item unchanged, as a new object', () => {
    const item = currentItem()
    const result = migrateToCurrent([item], context)
    expect(result).toStrictEqual({ items: [{ item, issues: [], from: 'schema-1' }], removed: [] })
    expect(result.items[0]?.item).not.toBe(item)
    expect(result.items[0]?.item.links).not.toBe(item.links)
  })

  it('migrates a collection that mixes versions, each item from its own', () => {
    const result = migrateToCurrent(
      { 'v6-1': v6Item(), 'cur-1': currentItem(), 'old-1': { ...v6Item({ id: 'old-1', v: 2 }) } },
      context,
    )
    expect(result.items.map(({ item, from }) => [item.id, from])).toEqual([
      ['v6-1', 'prototype-v6'],
      ['cur-1', 'schema-1'],
      ['old-1', 'prototype-v2'],
    ])
  })

  it('treats an empty map or list as an empty inventory', () => {
    expect(migrateToCurrent({}, context)).toStrictEqual({ items: [], removed: [] })
    expect(migrateToCurrent([], context)).toStrictEqual({ items: [], removed: [] })
  })

  it('never changes its input', () => {
    const stored = {
      'old-a': {
        id: 'old-a',
        name: 'Pine floor cleaner',
        cat: 'cleaning',
        sub: 'Floors',
        qty: 2,
        unit: 'bottle',
        min: 1,
        par: 2,
      },
      'v3-a': {
        id: 'v3-a',
        name: 'Rosemary Shampoo',
        cat: 'hair',
        sub: 'shampoo',
        qty: 1,
        unit: 'bottle',
        min: 1,
        par: 2,
        v: 3,
      },
      'v6-1': v6Item(),
      'cur-1': currentItem(),
    }
    const before = structuredCloneJson(stored)
    // Frozen: any write anywhere inside would throw in strict mode (all ES modules are strict).
    const result = migrateToCurrent(deepFreeze(stored), context)
    expect(stored).toStrictEqual(before)

    // And changing the result can't reach the input either.
    const first = result.items[0]
    if (!first) throw new Error('expected an item')
    first.item.links.product = 'https://changed.example/'
    expect(stored).toStrictEqual(before)
  })

  it('lists items a step removes instead of dropping them silently', () => {
    const result = migrateToCurrent(
      {
        i_ex05: {
          id: 'i_ex05',
          name: 'Sheet masks',
          cat: 'skincare',
          sub: 'Sleeping Mask',
          qty: 5,
          unit: 'sheet',
          min: 1,
          par: 5,
          example: true,
          v: 3,
        },
        'v6-1': v6Item(),
      },
      context,
    )
    expect(result.removed).toEqual([
      { key: 'i_ex05', from: 'prototype-v3', reason: expect.stringContaining('sheet mask') },
    ])
    expect(result.items.map(({ item }) => item.id)).toEqual(['v6-1'])
  })

  it('returns rule problems alongside the item instead of hiding or dropping it', () => {
    const result = migrateToCurrent(
      [v6Item({ expiry: '2026-02-30', link: 'javascript:alert(1)' })],
      context,
    )
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.issues.map((issue) => [issue.field, issue.code])).toEqual([
      ['expiresOn', 'invalid-date'],
      ['links.product', 'link-scheme'],
    ])
  })

  describe('reorder shares: any percentage, kept to 2 decimals', () => {
    it.each<[string, unknown, number, string[]]>([
      ['a share the old picker offered', 0.75, 0.75, []],
      ['any other whole percentage', 0.6, 0.6, []],
      ['more than 2 decimals, rounded', 0.333, 0.33, []],
      ['100%', 1, 1, []],
      ['missing: the prototype timed it at half', undefined, 0.5, []],
      ['0 meant "not set" in the prototype', 0, 0.5, []],
      ['over 100%: kept and reported, not guessed', 1.5, 1.5, ['invalid-share']],
    ])('%s (pct %s → share %s)', (_label, pct, share, codes) => {
      const [entry] = migrateToCurrent([v6Item({ pct })], context).items
      expect(entry?.item.reorder).toEqual({ kind: 'share', share })
      expect(entry?.issues.map((issue) => issue.code)).toEqual(codes)
    })

    it('accepts any share on a current item and reports one out of range', () => {
      const [ok, tooSmall] = migrateToCurrent(
        [
          currentItem({ reorder: { kind: 'share', share: 0.65 } }),
          currentItem({ id: 'cur-2', reorder: { kind: 'share', share: 0.001 } }),
        ],
        context,
      ).items
      expect(ok?.issues).toEqual([])
      expect(tooSmall?.issues.map((issue) => issue.code)).toEqual(['invalid-share'])
    })
  })

  it('normalises each item: a start date with no lifetime is cleared', () => {
    const result = migrateToCurrent(
      [v6Item({ unit: 'jar', life: 0, start: '2026-01-01', min: 1 })],
      context,
    )
    expect(result.items[0]?.item).not.toHaveProperty('startedOn')
    expect(result.items[0]?.issues).toEqual([])
  })

  describe('refuses data from a newer app', () => {
    it.each<[string, unknown]>([
      ['a newer schemaVersion', [currentItem({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })]],
      ['a newer prototype v', { 'v7-1': v6Item({ id: 'v7-1', v: 7 }) }],
      [
        'one newer item among current ones',
        [currentItem(), currentItem({ id: 'cur-2', schemaVersion: 99 })],
      ],
    ])('%s', (_label, input) => {
      expectMigrationError(() => migrateToCurrent(input, context), 'newer-version')
    })
  })

  describe('refuses garbage instead of returning an empty list', () => {
    it.each<[string, unknown, MigrationErrorCode]>([
      ['null', null, 'not-a-collection'],
      ['undefined', undefined, 'not-a-collection'],
      ['a string', 'my shelves', 'not-a-collection'],
      ['a number', 42, 'not-a-collection'],
      ['an array of numbers', [1, 2, 3], 'not-an-item'],
      ['a list holding null', [null], 'not-an-item'],
      ['a single item instead of a collection', currentItem(), 'not-an-item'],
      ['an empty object as an item', [{}], 'bad-field'],
      ['an unreadable version', [{ ...v6Item(), v: 'six' }], 'unknown-version'],
      ['a quantity written as text', [v6Item({ qty: 'two' })], 'bad-field'],
      ['an unknown category', [v6Item({ cat: 'garden' })], 'bad-field'],
      ['a share written as text', [v6Item({ pct: '50%' })], 'bad-field'],
      ['a current item missing its links', [{ ...currentItem(), links: undefined }], 'bad-field'],
      [
        'a current item missing householdId',
        [{ ...currentItem(), householdId: undefined }],
        'bad-field',
      ],
      ['a current item missing deleted', [{ ...currentItem(), deleted: undefined }], 'bad-field'],
      ['a current item with deleted as text', [{ ...currentItem(), deleted: 'no' }], 'bad-field'],
      ['two items with the same id', [currentItem(), currentItem()], 'duplicate-id'],
    ])('%s', (_label, input, code) => {
      expectMigrationError(() => migrateToCurrent(input, context), code)
    })

    it('says which item and field are wrong', () => {
      const error = expectMigrationError(
        () =>
          migrateToCurrent(
            { 'v6-1': v6Item(), 'v6-2': v6Item({ id: 'v6-2', qty: 'two' }) },
            context,
          ),
        'bad-field',
      )
      expect(error.itemKey).toBe('v6-2')
      expect(error.field).toBe('qty')
      expect(error.message).toContain('v6-2')
    })
  })

  it("gives prototype items the context's householdId", () => {
    const result = migrateToCurrent([v6Item()], { today: TODAY, householdId: 'other-household' })
    expect(result.items.map((entry) => entry.item.householdId)).toEqual(['other-household'])
  })

  it('throws InvalidDateError for an invalid today (a caller bug, not bad data)', () => {
    expect(() =>
      migrateToCurrent([], { today: '14/11/2026', householdId: 'test-household' }),
    ).toThrow(InvalidDateError)
  })
})

import { describe, expect, expectTypeOf, it } from 'vitest'
import { isValidIsoDateTime, type IsoDateTime } from '../dates'
import { defaultHouseholdPrefs, type Household, type HouseholdPrefs } from '../household'
import { CURRENT_SCHEMA_VERSION, type ReorderShare } from '../item'
import { DEFAULT_SHARE } from '../status'
import { makeHousehold } from './helpers/fixtures'

// Invented example data.
const named = {
  id: 'household-1',
  name: 'Example Home',
  createdAt: '2026-11-15T09:30:00.000Z',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  householdPrefs: { reorderDefaultShare: 0.75 },
} satisfies Household

// A minimal household: no name, default preferences.
const unnamed = {
  id: 'household-2',
  createdAt: '2026-11-15T09:30:00.000Z',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  householdPrefs: defaultHouseholdPrefs(),
} satisfies Household

describe('Household type', () => {
  it('accepts named and unnamed invented households', () => {
    expect(named.name).toBe('Example Home')
    expect('name' in unnamed).toBe(false)
  })

  it('types the important fields', () => {
    expectTypeOf<Household['id']>().toEqualTypeOf<string>()
    expectTypeOf<Household['name']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Household['createdAt']>().toEqualTypeOf<IsoDateTime>()
    expectTypeOf<Household['schemaVersion']>().toEqualTypeOf<number>()
    expectTypeOf<Household['householdPrefs']>().toEqualTypeOf<HouseholdPrefs>()
  })

  it('rejects a household without its required fields', () => {
    type WithDate = {
      id: string
      createdAt: Date
      schemaVersion: number
      householdPrefs: HouseholdPrefs
    }
    // @ts-expect-error: createdAt is required
    expectTypeOf<{ id: string; schemaVersion: number }>().toExtend<Household>()
    // @ts-expect-error: createdAt is text, not a Date
    expectTypeOf<WithDate>().toExtend<Household>()
  })

  it('has a valid fixture', () => {
    const household = makeHousehold()
    expect(isValidIsoDateTime(household.createdAt)).toBe(true)
    expect(household.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(household.householdPrefs).toEqual(defaultHouseholdPrefs())
  })
})

describe('HouseholdPrefs', () => {
  it('types the preference fields', () => {
    expectTypeOf<HouseholdPrefs['reorderDefaultShare']>().toEqualTypeOf<ReorderShare>()
  })

  it('defaults to DEFAULT_SHARE (reorder at 10% left)', () => {
    expect(defaultHouseholdPrefs()).toEqual({ reorderDefaultShare: DEFAULT_SHARE })
    expect(defaultHouseholdPrefs().reorderDefaultShare).toBe(0.9)
  })

  it('gives a new object each time, so changing one never changes another', () => {
    const first = defaultHouseholdPrefs()
    first.reorderDefaultShare = 0.5
    expect(defaultHouseholdPrefs().reorderDefaultShare).toBe(DEFAULT_SHARE)
    expect(defaultHouseholdPrefs()).not.toBe(defaultHouseholdPrefs())
  })
})

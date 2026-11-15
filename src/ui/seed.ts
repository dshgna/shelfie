// Invented example items for the shell until "Fill my shelves" and the database are wired in.
// Nothing here comes from a real inventory (privacy rule 6). Links use the reserved .example
// top-level domain (RFC 2606), which can never belong to a real shop.
//
// Each one starts as an invented purchase (how many, how long ago, how long one lasts) and goes
// through calcStock, as an import would: units bought minus whole lifetimes passed since the
// purchase gives the quantity, and calcStock also sets lifeDays and startedOn. Dates are relative
// to `today`, so the stats always show a mix of statuses.

import { plusDays, type IsoDate } from '../domain/dates'
import { CURRENT_SCHEMA_VERSION, type Item } from '../domain/item'
import { calcStock } from '../domain/stock'

export const SEED_HOUSEHOLD_ID = 'household-example'

interface ExamplePurchase {
  /** Units bought. */
  bought: number
  /** How many days ago they were bought. */
  daysAgo: number
  /** Days one lasts; left out, calcStock guesses it from the name, size, unit and category. */
  lifeDays?: number
}

type ExampleFields = Pick<Item, 'id' | 'name' | 'brand' | 'category' | 'group' | 'location'> &
  Partial<Pick<Item, 'unit' | 'size' | 'reorder' | 'buyUpTo' | 'expiresOn' | 'link'>>

function example(
  fields: ExampleFields,
  purchase: ExamplePurchase,
  today: IsoDate,
): Omit<Item, 'updatedAt'> {
  const base = { unit: 'bottle', size: '', ...fields }
  const stock = calcStock(
    {
      quantity: purchase.bought,
      boughtAt: plusDays(today, -purchase.daysAgo),
      size: base.size,
      unit: base.unit,
      name: base.name,
      category: base.category,
      lifeDays: purchase.lifeDays,
    },
    today,
  )
  const item: Omit<Item, 'updatedAt'> = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    householdId: SEED_HOUSEHOLD_ID,
    reorder: { kind: 'count', atOrBelow: 1 },
    buyUpTo: purchase.bought,
    notes: '',
    isExample: true,
    deleted: false,
    ...base,
    quantity: stock.left,
    lifeDays: stock.lifeDays,
  }
  if (stock.startedOn !== undefined) item.startedOn = stock.startedOn
  return item
}

export function seedItems(today: IsoDate): Omit<Item, 'updatedAt'>[] {
  return [
    example(
      {
        id: 'ex-cleansing-balm',
        name: 'Cleansing Balm',
        brand: 'Meadowbrook',
        category: 'skincare',
        group: 'Step 1 · Oil Cleanser',
        location: 'Bathroom shelf',
        unit: 'jar',
        reorder: { kind: 'share', share: 0.9 },
      },
      { bought: 1, daysAgo: 20, lifeDays: 90 },
      today,
    ),
    example(
      {
        id: 'ex-gel-cleanser',
        name: 'Gel Cleanser',
        brand: 'Fernleaf',
        category: 'skincare',
        group: 'Step 2 · Water Cleanser',
        location: 'Bathroom shelf',
        unit: 'tube',
      },
      { bought: 2, daysAgo: 50, lifeDays: 60 },
      today,
    ),
    example(
      {
        id: 'ex-eye-cream',
        name: 'Eye Cream',
        brand: 'Fernleaf',
        category: 'skincare',
        group: 'Eye Cream',
        location: 'Bathroom shelf',
        unit: 'jar',
        reorder: { kind: 'count', atOrBelow: 0 },
        expiresOn: plusDays(today, -12),
      },
      { bought: 1, daysAgo: 40, lifeDays: 120 },
      today,
    ),
    example(
      {
        id: 'ex-shampoo',
        name: 'Oat Shampoo',
        brand: 'Little Hill',
        category: 'hair',
        group: 'Shampoo',
        location: 'Shower',
        size: '250 ml',
        link: 'https://www.corner-shop.example/oat-shampoo',
      },
      { bought: 2, daysAgo: 70, lifeDays: 45 },
      today,
    ),
    example(
      {
        id: 'ex-toothpaste',
        name: 'Mint Toothpaste',
        brand: 'Brightwell',
        category: 'dental',
        group: 'Dental Care',
        location: 'Bathroom shelf',
        unit: 'tube',
        link: 'https://pharmacy.example/mint-toothpaste',
      },
      { bought: 3, daysAgo: 10, lifeDays: 30 },
      today,
    ),
    example(
      {
        id: 'ex-dish-soap',
        name: 'Dish Soap',
        brand: 'Little Hill',
        category: 'kitchen',
        group: 'Dishwashing',
        location: 'Under the sink',
        link: 'https://www.corner-shop.example/dish-soap',
      },
      { bought: 2, daysAgo: 25, lifeDays: 40 },
      today,
    ),
    example(
      {
        id: 'ex-sponges',
        name: 'Kitchen Sponges',
        brand: '',
        category: 'kitchen',
        group: 'Dishwashing',
        location: 'Under the sink',
        unit: 'sponge',
        link: 'http://refill.example/kitchen-sponges',
      },
      { bought: 2, daysAgo: 70, lifeDays: 30 },
      today,
    ),
    example(
      {
        id: 'ex-toilet-paper',
        name: 'Toilet Paper',
        brand: 'Softcloud',
        category: 'bathroom',
        group: 'Toilet Paper',
        location: 'Hall cupboard',
        unit: 'roll',
        reorder: { kind: 'count', atOrBelow: 4 },
      },
      { bought: 12, daysAgo: 20, lifeDays: 5 },
      today,
    ),
    example(
      {
        id: 'ex-laundry-liquid',
        name: 'Laundry Liquid',
        brand: 'Brightwell',
        category: 'laundry',
        group: 'Washing',
        location: 'Utility room',
        link: 'https://www.corner-shop.example/laundry-liquid',
      },
      { bought: 1, daysAgo: 15, lifeDays: 60 },
      today,
    ),
    example(
      {
        id: 'ex-plasters',
        name: 'Fabric Plasters',
        brand: 'Brightwell',
        category: 'health',
        group: 'First Aid',
        location: 'Hall cupboard',
        unit: 'box',
        expiresOn: plusDays(today, 30),
      },
      { bought: 2, daysAgo: 5 },
      today,
    ),
    example(
      {
        id: 'ex-candle',
        name: 'Beeswax Candle',
        brand: 'Meadowbrook',
        category: 'household',
        group: 'Other',
        location: 'Living room',
        unit: 'candle',
      },
      { bought: 2, daysAgo: 3, lifeDays: 20 },
      today,
    ),
  ]
}

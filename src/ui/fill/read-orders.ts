// Reading pasted order text into item rows. FOR NOW THIS IS A MOCK: it never sends anything
// anywhere and returns the same invented rows whatever is pasted.
//
// Step 7 replaces only the body of readOrders with a call to the Supabase edge function
// (functions/ai-import). Sending an order to the AI will be an explicit action the person takes
// each time ("Read my orders"), and only the order text is sent. The reply keeps this shape:
// `rows` is a list of raw rows, each checked by the domain's normRow, so a reply that is wrong in
// any way is cleaned or dropped there, never trusted.
//
// The raw row fields normRow reads (all optional except `name`): name, brand, size, unit, count,
// date (YYYY-MM-DD), shop, cat, sub, status ('delivered' | 'returned' | 'cancelled' | 'unknown'),
// confidence ('high' | 'medium' | 'low'), note (why that shelf), alts ([{ cat, sub }]), link.

import { plusDays, startOfToday } from '../../domain/dates'

export interface ReadOrdersReply {
  rows: unknown[]
}

/** Invented rows only (privacy rule 6). Dates are relative to today so estimates stay sensible. */
function exampleRows(today: string): unknown[] {
  return [
    {
      name: 'Oat Shampoo',
      brand: 'Little Hill',
      size: '250 ml',
      unit: 'bottle',
      count: 1,
      date: plusDays(today, -12),
      shop: 'Corner Shop',
      cat: 'hair',
      sub: 'Shampoo',
      status: 'delivered',
      confidence: 'high',
    },
    {
      name: 'Rice Water Toner',
      brand: 'Fernleaf',
      size: '200 ml',
      unit: 'bottle',
      count: 1,
      date: plusDays(today, -12),
      shop: 'Corner Shop',
      cat: 'skincare',
      sub: 'Step 3 · Toner',
      status: 'delivered',
      confidence: 'high',
    },
    {
      name: 'Gentle Gel Wash',
      brand: 'Meadowbrook',
      size: '150 ml',
      unit: 'tube',
      count: 2,
      date: plusDays(today, -40),
      shop: 'Corner Shop',
      cat: 'skincare',
      sub: 'Step 2 · Water Cleanser',
      status: 'delivered',
      confidence: 'low',
      note: 'Could be a face or a body wash.',
      alts: [{ cat: 'hair', sub: 'Body Soap' }],
    },
    {
      name: 'Lemon Washing-Up Liquid',
      brand: 'Brightwell',
      size: '500 ml',
      unit: 'bottle',
      count: 3,
      date: plusDays(today, -5),
      shop: 'Corner Shop',
      cat: 'kitchen',
      sub: 'Dishwashing',
      status: 'delivered',
      confidence: 'high',
    },
    {
      name: 'Lavender Bath Salts',
      brand: 'Meadowbrook',
      size: '400 g',
      unit: 'jar',
      count: 1,
      date: plusDays(today, -5),
      shop: 'Corner Shop',
      cat: 'beauty',
      sub: 'Body Creams',
      status: 'returned',
      confidence: 'medium',
    },
  ]
}

/**
 * The items found in pasted order text. Mock: ignores the text and resolves with invented rows.
 * No fetch, no network.
 */
export async function readOrders(text: string): Promise<ReadOrdersReply> {
  void text
  return { rows: exampleRows(startOfToday(new Date())) }
}

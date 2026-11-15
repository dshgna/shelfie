// What the Shopping tab shows: what to buy and how many, grouped by the shop each item's link
// points to. Ported from the prototype's shopLines, buyFor, shopGroups and copyList. Which items
// need buying (needsRestock) and how many (buyCount) come from src/domain.
//
// Links: only https links are opened. An http link is offered as its https version, marked as
// unchecked: checking that it works would mean contacting the shop, and the app makes no network
// calls of its own (CLAUDE.md, hard rules 1 and 7). Nothing here touches the network.

import { CATEGORIES, type Item, type Unit } from '../domain/item'
import { buyCount, needsRestock } from '../domain/status'
import type { IsoDate } from '../domain/dates'
import { isSafeLink } from '../domain/validate'

export interface ShoppingLine {
  item: Item
  /** How many to buy: the person's own number, or buyCount. */
  buy: number
}

/** The items that need buying, by category then name (prototype shopLines). */
export function shoppingLines(
  items: readonly Item[],
  today: IsoDate,
  overrides: Readonly<Record<string, number>>,
): ShoppingLine[] {
  return items
    .filter((item) => needsRestock(item, today))
    .sort(
      (a, b) =>
        CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
        a.name.localeCompare(b.name),
    )
    .map((item) => ({ item, buy: overrides[item.id] ?? buyCount(item) }))
}

export interface ShopLink {
  /** Always https. */
  url: string
  /** The shop's host name, without "www.". */
  host: string
  /** True when the stored link was http and this is its https version, which nobody checked. */
  upgraded: boolean
}

/** The item's link as an https address, or undefined when it has no usable link. */
export function shopLink(item: Item): ShopLink | undefined {
  if (item.link === undefined) return undefined
  const check = isSafeLink(item.link)
  if (!check.ok) return undefined
  const url = check.insecure ? item.link.replace(/^http:/i, 'https:') : item.link
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return undefined
    return {
      url: parsed.href,
      host: parsed.hostname.replace(/^www\./, ''),
      upgraded: check.insecure,
    }
  } catch {
    return undefined
  }
}

export interface LinkedLine extends ShoppingLine {
  link: ShopLink
}

export interface ShopGroup {
  host: string
  lines: LinkedLine[]
}

/** Lines grouped by shop, shops in the order they first appear, then the lines with no link. */
export function groupByShop(lines: readonly ShoppingLine[]): {
  shops: ShopGroup[]
  none: ShoppingLine[]
} {
  const shops = new Map<string, LinkedLine[]>()
  const none: ShoppingLine[] = []
  for (const line of lines) {
    const link = shopLink(line.item)
    if (!link) {
      none.push(line)
      continue
    }
    const group = shops.get(link.host) ?? []
    group.push({ ...line, link })
    shops.set(link.host, group)
  }
  return { shops: [...shops].map(([host, grouped]) => ({ host, lines: grouped })), none }
}

/** "bottle" or "bottles" (prototype plural). */
export function plural(unit: Unit, count: number): string {
  if (unit === '' || count === 1) return unit
  return /(s|x|ch|sh)$/i.test(unit) ? `${unit}es` : `${unit}s`
}

/** The text "Copy list" puts on the clipboard (prototype copyList). */
export function listText(lines: readonly ShoppingLine[]): string {
  const rows = lines.map(({ item, buy }) => {
    const unit = plural(item.unit, buy)
    return `- ${item.name} x${buy}${unit ? ` (${unit})` : ''}`
  })
  return ['Shopping list', ...rows].join('\n')
}

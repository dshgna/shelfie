// The Shopping tab: what to buy and how many, grouped by shop. Ported from the prototype's
// shopping list (tick, how many, "Add N checked to stock", "Copy list") and its "Your Order, by
// Shop" cards (Open, Open all, Copy links). No greener swaps yet, and no ethical labels (no
// ratings source has been chosen). Nothing here contacts the network: links open in a new tab
// only when the person taps them.

import { useRef, useState } from 'react'
import { Button, Checkbox, Group, Input, Link, NumberField } from 'react-aria-components'
import type { IsoDate } from '../domain/dates'
import type { Item } from '../domain/item'
import { dueByTime, timing } from '../domain/status'
import {
  groupByShop,
  listText,
  plural,
  shoppingLines,
  type LinkedLine,
  type ShoppingLine,
} from './shopping'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const BUTTON = `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 font-semibold ${FOCUS}`
const SECONDARY = `${BUTTON} border-edge bg-surface text-ink hover:bg-surface-2`
const STEP = `grid size-[44px] flex-none place-items-center rounded-full border border-edge bg-surface text-ink hover:bg-surface-2 data-disabled:opacity-40 ${FOCUS}`

export interface ShoppingState {
  /** How many to buy, where the person changed it. */
  buy: Readonly<Record<string, number>>
  /** Ticked item ids. */
  checked: ReadonlySet<string>
}

interface ShoppingTabProps {
  items: readonly Item[]
  today: IsoDate
  state: ShoppingState
  onBuyChange: (id: string, buy: number) => void
  onCheckedChange: (id: string, checked: boolean) => void
  /** Adds each ticked line's number to its stock. Resolves to how many were saved. */
  onRestock: (lines: readonly ShoppingLine[]) => Promise<number>
}

/** Copies text on a tap. Falls back to showing the text, selected, when the clipboard refuses. */
async function copy(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function detail(item: Item, today: IsoDate): string {
  const parts = [`${item.quantity} left`, item.location || item.group]
  const t = timing(item, today)
  if (t && dueByTime(item, today)) parts.push(`current one ${Math.round(t.used * 100)}% used`)
  return parts.join(' · ')
}

function Line({
  line,
  today,
  checked,
  onBuyChange,
  onCheckedChange,
}: {
  line: ShoppingLine | LinkedLine
  today: IsoDate
  checked: boolean
  onBuyChange: ShoppingTabProps['onBuyChange']
  onCheckedChange: ShoppingTabProps['onCheckedChange']
}) {
  const { item, buy } = line
  const link = 'link' in line ? line.link : undefined
  return (
    <li className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <Checkbox
          isSelected={checked}
          onChange={(on) => onCheckedChange(item.id, on)}
          className={`group flex min-h-[44px] min-w-0 flex-1 cursor-default items-center gap-3 rounded-xl ${FOCUS}`}
        >
          {({ isSelected }) => (
            <>
              <span
                aria-hidden="true"
                className={`grid size-6 flex-none place-items-center rounded-md border-2 ${isSelected ? 'border-accent bg-accent text-surface' : 'border-edge bg-surface'}`}
              >
                {isSelected && (
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    className="fill-none stroke-current [stroke-width:2.4] [stroke-linecap:round] [stroke-linejoin:round]"
                  >
                    <path d="M3 8.5l3.2 3L13 4.5" />
                  </svg>
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{item.name}</span>
                <span className="text-sm text-muted">{detail(item, today)}</span>
              </span>
            </>
          )}
        </Checkbox>
        <div className="flex flex-wrap items-center gap-2 pl-9 md:pl-0">
          <NumberField
            value={buy}
            minValue={1}
            step={1}
            formatOptions={{ maximumFractionDigits: 0 }}
            aria-label={`Number of ${item.name} to buy`}
            onChange={(value) => {
              if (Number.isInteger(value) && value >= 1) onBuyChange(item.id, value)
            }}
            className="flex items-center gap-2"
          >
            <span aria-hidden="true" className="text-sm text-muted">
              Buy
            </span>
            <Group className="flex items-center gap-1">
              <Button slot="decrement" className={STEP}>
                <svg
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  className="fill-none stroke-current [stroke-width:2] [stroke-linecap:round]"
                >
                  <path d="M3 8h10" />
                </svg>
              </Button>
              <Input
                className={`h-[44px] w-12 rounded-xl border border-edge bg-surface text-center tabular-nums ${FOCUS}`}
              />
              <Button slot="increment" className={STEP}>
                <svg
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  className="fill-none stroke-current [stroke-width:2] [stroke-linecap:round]"
                >
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </Button>
            </Group>
            <span aria-hidden="true" className="min-w-14 text-sm text-muted">
              {plural(item.unit, buy)}
            </span>
          </NumberField>
          {link && (
            <Link
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${item.name} at ${link.host} (opens in a new tab)`}
              className={SECONDARY}
            >
              Open
            </Link>
          )}
        </div>
      </div>
      {link?.upgraded && (
        <p className="pl-9 text-sm text-warn">
          This link was http, so Shelfie changed it to https. It couldn&apos;t check that it works.
        </p>
      )}
    </li>
  )
}

export function ShoppingTab({
  items,
  today,
  state,
  onBuyChange,
  onCheckedChange,
  onRestock,
}: ShoppingTabProps) {
  const [message, setMessage] = useState('')
  const [fallback, setFallback] = useState<string | null>(null)
  const fallbackRef = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const lines = shoppingLines(items, today, state.buy)
  const { shops, none } = groupByShop(lines)
  const ticked = lines.filter((line) => state.checked.has(line.item.id))

  const say = (text: string) => {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(''), 4000)
  }

  const copyOrShow = async (text: string, done: string) => {
    if (await copy(text)) {
      setFallback(null)
      say(done)
      return
    }
    setFallback(text)
    say('Copy did not work. Select the text below and copy it.')
    setTimeout(() => fallbackRef.current?.select(), 0)
  }

  if (lines.length === 0) {
    return (
      <p className="text-muted">
        All stocked up, nothing to buy. Items land here when they hit their reorder point.
      </p>
    )
  }

  const lineProps = { today, onBuyChange, onCheckedChange }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        Set how many you are buying, tick what you bought, then add it to stock.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className={SECONDARY}
          onPress={() => void copyOrShow(listText(lines), 'Shopping list copied')}
        >
          Copy list
        </Button>
        <Button
          isDisabled={ticked.length === 0}
          onPress={() => {
            void onRestock(ticked).then((saved) =>
              say(`${saved} item${saved === 1 ? '' : 's'} restocked`),
            )
          }}
          className={`${BUTTON} border-accent bg-accent text-surface hover:opacity-90 data-disabled:opacity-50`}
        >
          Add {ticked.length > 0 ? `${ticked.length} ` : ''}checked to stock
        </Button>
      </div>
      <p role="status" className="min-h-6 text-sm font-semibold text-sprout-deep">
        {message}
      </p>
      {fallback !== null && (
        <textarea
          ref={fallbackRef}
          readOnly
          value={fallback}
          aria-label="Text to copy"
          rows={Math.min(10, fallback.split('\n').length)}
          className={`w-full rounded-xl border border-edge bg-surface p-3 text-sm ${FOCUS}`}
        />
      )}

      <h2 className="font-display text-xl font-semibold md:text-[22px]">Your Order, by Shop</h2>
      {shops.map((shop) => (
        <section
          key={shop.host}
          aria-label={shop.host}
          className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4"
        >
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-lg font-semibold">{shop.host}</h3>
            <span className="text-sm text-muted">
              {shop.lines.length} item{shop.lines.length === 1 ? '' : 's'}
            </span>
          </div>
          <ul>
            {shop.lines.map((line) => (
              <Line
                key={line.item.id}
                line={line}
                checked={state.checked.has(line.item.id)}
                {...lineProps}
              />
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              className={SECONDARY}
              aria-label={`Open all ${shop.host} links in new tabs`}
              onPress={() => {
                for (const line of shop.lines) {
                  window.open(line.link.url, '_blank', 'noopener,noreferrer')
                }
                if (shop.lines.length > 1)
                  say('If only one tab opened, allow pop-ups for this page.')
              }}
            >
              Open all
            </Button>
            <Button
              className={SECONDARY}
              aria-label={`Copy ${shop.host} links`}
              onPress={() =>
                void copyOrShow(shop.lines.map((line) => line.link.url).join('\n'), 'Links copied')
              }
            >
              Copy links
            </Button>
          </div>
        </section>
      ))}
      {none.length > 0 && (
        <section
          aria-label="No link yet"
          className="flex flex-col gap-1 rounded-2xl border border-dashed border-edge bg-surface p-4"
        >
          <h3 className="font-display text-lg font-semibold">No Link Yet</h3>
          <ul>
            {none.map((line) => (
              <Line
                key={line.item.id}
                line={line}
                checked={state.checked.has(line.item.id)}
                {...lineProps}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

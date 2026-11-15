import { Button, Meter } from 'react-aria-components'
import type { IsoDate } from '../domain/dates'
import type { Item } from '../domain/item'
import { needsRestock, stockLeft } from '../domain/status'
import { containerIcon } from './containerIcons'

const STEP =
  'grid size-[44px] flex-none place-items-center rounded-full border border-edge bg-surface text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-pressed:bg-surface-2'

interface ItemRowProps {
  item: Item
  today: IsoDate
  onChange: (id: string, delta: 1 | -1) => void
  onOpen: (item: Item) => void
}

/** One item: its little jar, name and brand (which open it), a stock bar, and one more / one fewer. */
export function ItemRow({ item, today, onChange, onOpen }: ItemRowProps) {
  const low = needsRestock(item, today)
  const percent = Math.round(stockLeft(item, today) * 100)

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Button
          aria-label={`Open ${item.name} to edit`}
          onPress={() => onOpen(item)}
          className="-m-1 flex min-h-[44px] min-w-0 items-center gap-3 rounded-xl p-1 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <img
            src={containerIcon(item.unit, low)}
            alt=""
            width={40}
            height={48}
            className="h-12 w-10 flex-none"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate leading-tight font-semibold">{item.name}</span>
            {item.brand && (
              <span className="truncate text-sm leading-tight text-muted">{item.brand}</span>
            )}
          </span>
        </Button>
        <Meter
          value={percent}
          aria-label={`${item.name} stock`}
          valueLabel={`${percent}% left`}
          className="mt-1 ml-[52px] max-w-48"
        >
          {({ percentage }) => (
            <div className="h-2 overflow-hidden rounded-full bg-wood-45">
              <div
                className={`h-full rounded-full ${low ? 'bg-coral' : 'bg-sprout'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
        </Meter>
      </div>
      <div className="flex flex-none items-center gap-1">
        <Button
          aria-label={`Remove one ${item.name}`}
          onPress={() => onChange(item.id, -1)}
          className={STEP}
        >
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
        <span
          aria-live="polite"
          className="min-w-12 text-center text-sm font-semibold text-muted tabular-nums"
        >
          {item.quantity} left
        </span>
        <Button
          aria-label={`Add one ${item.name}`}
          onPress={() => onChange(item.id, 1)}
          className={STEP}
        >
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
      </div>
    </li>
  )
}

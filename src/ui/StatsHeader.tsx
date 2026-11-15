import { Button } from 'react-aria-components'
import { Mascot, type Mood } from './Mascot'
import type { ShowFilter } from './Filters'

// Ported from the prototype's renderStats. The canvas also shows "ethical picks": left out,
// because no ratings source has been chosen (design rules).

const LABEL: Record<Mood, string> = {
  sleepy: 'Nothing to do',
  party: 'Restocked',
  worried: 'Running low',
  happy: 'Well stocked',
}

const CHIP =
  'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-chip-line bg-chip-bg py-0 pr-3 pl-2.5 font-semibold whitespace-nowrap text-warn hover:underline hover:underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

interface StatsHeaderProps {
  total: number
  restock: number
  expiring: number
  attention: number
  onShow: (show: ShowFilter) => void
}

export function StatsHeader({ total, restock, expiring, attention, onShow }: StatsHeaderProps) {
  const mood: Mood = total === 0 ? 'sleepy' : restock > 0 ? 'worried' : 'happy'
  const pctOk = total ? Math.round(((total - attention) / total) * 100) : 100
  const gauge = mood === 'worried' ? Math.max(8, pctOk) : pctOk
  const label = LABEL[mood]

  return (
    <section
      aria-label="Summary"
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-[20px] border border-line bg-surface px-3.5 py-3 md:gap-x-5 md:rounded-3xl md:px-6 md:py-5"
    >
      <Button
        aria-label={`Shelfie says: ${label}. Show everything`}
        onPress={() => onShow('all')}
        className="w-[52px] rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:row-span-2 md:w-[132px]"
      >
        <Mascot mood={mood} gauge={gauge} onLedge />
      </Button>
      <div className="flex min-w-0 flex-col gap-0.5 md:self-end">
        <p className="font-display text-xl leading-tight font-semibold md:text-[30px]">{label}</p>
        <p className="text-sm text-muted md:text-[15px]">{total} items tracked</p>
      </div>
      <div className="col-span-2 flex flex-wrap gap-2 md:col-span-1 md:col-start-2 md:self-start">
        <Button className={CHIP} onPress={() => onShow('restock')}>
          <svg viewBox="0 0 22 8" width="22" height="8" aria-hidden="true" className="flex-none">
            <rect className="fill-wood-45" width="22" height="8" rx="4" />
            <rect className="fill-coral" width="4" height="8" rx="4" />
          </svg>
          {restock} to restock
        </Button>
        <Button className={CHIP} onPress={() => onShow('expiring')}>
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            aria-hidden="true"
            className="flex-none fill-none stroke-current [stroke-width:2.2] [stroke-linecap:round] [stroke-linejoin:round]"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {expiring} expiring
        </Button>
      </div>
    </section>
  )
}

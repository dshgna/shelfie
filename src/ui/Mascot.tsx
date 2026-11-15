// The jar mascot, drawn from the prototype's mascot() and design/assets/mascot. Colours come from
// the tokens through Tailwind fill/stroke utilities. Static: no bobbing or blinking yet.

export type Mood = 'happy' | 'worried' | 'sleepy' | 'party'

interface MascotProps {
  mood: Mood
  /** 0 to 100: how full the label's gauge is. */
  gauge: number
  /** Stand the jar on its wooden ledge (hero and summary only). */
  onLedge?: boolean
  className?: string
}

const STROKE =
  'fill-none stroke-ink [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:4]'

function Face({ mood }: { mood: Mood }) {
  if (mood === 'sleepy') {
    return (
      <>
        <path className={STROKE} d="M74 108 L90 108" />
        <path className={STROKE} d="M110 108 L126 108" />
        <ellipse className="fill-ink" cx="100" cy="128" rx="5" ry="4" />
      </>
    )
  }
  if (mood === 'party') {
    return (
      <>
        <path className={STROKE} d="M74 110 Q82 98 90 110" />
        <path className={STROKE} d="M110 110 Q118 98 126 110" />
        <path className="fill-ink" d="M86 122 Q100 148 114 122 Z" />
      </>
    )
  }
  return (
    <>
      {mood === 'worried' && (
        <>
          <path className={`${STROKE} [stroke-width:3]`} d="M72 96 L90 89" />
          <path className={`${STROKE} [stroke-width:3]`} d="M128 96 L110 89" />
        </>
      )}
      <ellipse className="fill-ink" cx="82" cy="106" rx="6" ry="8" />
      <ellipse className="fill-ink" cx="118" cy="106" rx="6" ry="8" />
      <circle className="fill-white" cx="84" cy="103" r="2.2" />
      <circle className="fill-white" cx="120" cy="103" r="2.2" />
      <path
        className={STROKE}
        d={mood === 'worried' ? 'M90 134 Q100 125 110 134' : 'M88 124 Q100 136 112 124'}
      />
    </>
  )
}

export function Mascot({ mood, gauge, onLedge = false, className }: MascotProps) {
  const width = Math.min(60, Math.max(4, Math.round(gauge * 0.6)))
  return (
    <svg
      className={`block overflow-visible ${className ?? ''}`}
      viewBox={`0 0 200 ${onLedge ? 220 : 205}`}
      aria-hidden="true"
    >
      {onLedge && <ellipse className="fill-ink opacity-15" cx="100" cy="200" rx="58" ry="7" />}
      <ellipse
        className="fill-eu-shade"
        cx="160"
        cy="132"
        rx="12"
        ry="17"
        transform="rotate(-14 160 132)"
      />
      <ellipse
        className="fill-eu-shade"
        cx="40"
        cy="132"
        rx="12"
        ry="17"
        transform="rotate(14 40 132)"
      />
      <rect className="fill-eu" x="46" y="74" width="108" height="122" rx="38" />
      <rect className="fill-wood" x="60" y="52" width="80" height="26" rx="11" />
      <path
        className="fill-none stroke-sprout [stroke-width:4] [stroke-linecap:round]"
        d="M100 52 L100 32"
      />
      <ellipse
        className="fill-sprout"
        cx="86"
        cy="28"
        rx="15"
        ry="8"
        transform="rotate(-24 86 28)"
      />
      <ellipse
        className="fill-sprout"
        cx="115"
        cy="24"
        rx="15"
        ry="8"
        transform="rotate(24 115 24)"
      />
      <Face mood={mood} />
      {mood === 'worried' && (
        <path className="fill-accent opacity-75" d="M146 88 Q152 98 146 104 Q140 98 146 88 Z" />
      )}
      <rect className="fill-cream" x="64" y="146" width="72" height="34" rx="12" />
      <rect className="fill-wood-45" x="70" y="158" width="60" height="10" rx="5" />
      <rect
        className={gauge <= 15 ? 'fill-coral' : 'fill-sprout'}
        x="70"
        y="158"
        width={width}
        height="10"
        rx="5"
      />
      {onLedge && <rect className="fill-wood" x="8" y="196" width="184" height="14" rx="6" />}
    </svg>
  )
}

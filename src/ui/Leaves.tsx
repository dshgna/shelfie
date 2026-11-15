// The Botanical Leaves background, from design/assets/background (leaves-top-right.svg and
// leaves-bottom-left.svg), coloured with the tokens instead of hex values. Drawn in the corners
// over --bg: top right on every width, bottom left from md up (as on the canvas screens).

type Tone = 'accent' | 'sprout'

const TONE: Record<Tone, string> = {
  accent: 'fill-accent/16 stroke-accent/45',
  sprout: 'fill-sprout/16 stroke-sprout/45',
}

function Leaf({ x, y, angle, tone }: { x: number; y: number; angle: number; tone: Tone }) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${angle})`}
      className={`${TONE[tone]} [stroke-width:2]`}
    >
      <path d="M0 0C40-50 110-50 150 0C110 50 40 50 0 0Z" />
      <path className="fill-none" d="M0 0L150 0" />
    </g>
  )
}

export function Leaves() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg viewBox="1090 -30 320 270" className="absolute top-0 right-0 w-[200px] md:w-[320px]">
        <Leaf x={1330} y={70} angle={150} tone="accent" />
        <Leaf x={1340} y={100} angle={120} tone="sprout" />
        <Leaf x={1290} y={40} angle={170} tone="accent" />
      </svg>
      <svg viewBox="-40 690 250 230" className="absolute bottom-0 left-0 hidden w-[250px] md:block">
        <Leaf x={-10} y={840} angle={-30} tone="sprout" />
        <Leaf x={10} y={900} angle={-60} tone="accent" />
        <Leaf x={-20} y={800} angle={-5} tone="sprout" />
      </svg>
    </div>
  )
}

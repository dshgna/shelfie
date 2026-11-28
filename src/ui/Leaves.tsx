// The Botanical Leaves background, from design/assets/background (leaves-top-right.svg and
// leaves-bottom-left.svg), coloured with the tokens instead of hex values. Drawn in the corners
// over --bg: top right on every width, bottom left from md up (as on the canvas screens).
// `corners="both"` draws both corners at every width: on phones 260px wide and partly off-screen
// (top right 40px up and 70px right, bottom left 50px down and 90px left), as in the phone Create
// account and Sign in design (prototype-create-account-sign-in.html).

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

export function Leaves({ corners = 'default' }: { corners?: 'default' | 'both' }) {
  const both = corners === 'both'
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg
        viewBox="1090 -30 320 270"
        className={`absolute md:top-0 md:right-0 md:w-[320px] ${both ? '-top-10 -right-[70px] w-[260px]' : 'top-0 right-0 w-[200px]'}`}
      >
        <Leaf x={1330} y={70} angle={150} tone="accent" />
        <Leaf x={1340} y={100} angle={120} tone="sprout" />
        <Leaf x={1290} y={40} angle={170} tone="accent" />
      </svg>
      <svg
        viewBox="-40 690 250 230"
        className={`absolute md:bottom-0 md:left-0 md:block md:w-[250px] ${both ? '-bottom-[50px] -left-[90px] block w-[260px]' : 'bottom-0 left-0 hidden'}`}
      >
        <Leaf x={-10} y={840} angle={-30} tone="sprout" />
        <Leaf x={10} y={900} angle={-60} tone="accent" />
        <Leaf x={-20} y={800} angle={-5} tone="sprout" />
      </svg>
    </div>
  )
}

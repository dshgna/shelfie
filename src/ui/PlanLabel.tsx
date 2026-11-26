// The Now / Planned label: Now on Eucalyptus, Planned on the cream chip in --warn. Design rule:
// never "Coming soon".

export function PlanLabel({ now }: { now: boolean }) {
  return (
    <span
      className={`flex-none rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        now ? 'border-eu bg-eu-20 text-sprout-deep' : 'border-chip-line bg-chip-bg text-warn'
      }`}
    >
      {now ? 'Now' : 'Planned'}
    </span>
  )
}

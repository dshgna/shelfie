import type { StatusLabel } from './status-label'
import { statusIcon } from './statusIcons'

const TONE: Record<StatusLabel['tone'], string> = {
  bad: 'border-chip-line bg-chip-bg text-danger',
  warn: 'border-chip-line bg-chip-bg text-warn',
  ok: 'border-eu bg-eu-20 text-sprout-deep',
}

/**
 * An item's one status chip. The text says the status and the icon differs by kind, so it never
 * relies on colour alone. The icon is decorative (alt=""): the text already says it.
 */
export function StatusChip({ label }: { label: StatusLabel }) {
  return (
    <span
      className={`inline-flex min-h-[26px] items-center gap-1.5 self-start rounded-full border py-0.5 pr-2.5 pl-2 text-[13px] leading-tight font-semibold ${TONE[label.tone]}`}
    >
      <img
        src={statusIcon(label.kind)}
        alt=""
        width={16}
        height={16}
        className="size-4 flex-none"
      />
      {label.text}
    </span>
  )
}

// The 16px status icons from design/assets/status, one per chip kind. Inlined by Vite as data:
// URLs (allowed by the CSP's img-src), like the container icons.

import type { ChipKind } from './status-label'

const FILES = import.meta.glob<string>('../../design/assets/status/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const FILE_FOR: Record<ChipKind, string> = {
  expired: 'expired',
  out: 'gauge-low',
  order: 'gauge-low',
  low: 'gauge-low',
  'use-soon': 'clock',
  left: 'gauge-ok',
}

export function statusIcon(kind: ChipKind): string {
  const url = FILES[`../../design/assets/status/${FILE_FOR[kind]}.svg`]
  if (url === undefined) throw new Error(`design/assets/status/${FILE_FOR[kind]}.svg is missing`)
  return url
}

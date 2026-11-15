// The little jar for each unit, from design/assets/containers: <unit>.svg, or <unit>-low.svg when
// the item needs restocking. A unit without its own file (one the person typed) gets box.svg.
// The file name is the unit name (see design/assets/containers/units.json).
//
// Vite turns each file into a URL at build time. Small files are inlined as data: URLs, the rest
// are emitted to dist/assets on our own origin; the CSP's img-src allows both ('self' data:).

import type { Unit } from '../domain/item'

const FILES = import.meta.glob<string>('../../design/assets/containers/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

function url(name: string): string | undefined {
  return FILES[`../../design/assets/containers/${name}.svg`]
}

/** The icon URL for a unit, low or not. Falls back to box.svg for units without their own file. */
export function containerIcon(unit: Unit, low: boolean): string {
  const key = unit.trim().toLowerCase()
  const own = url(low ? `${key}-low` : key)
  const box = url(low ? 'box-low' : 'box')
  if (own !== undefined) return own
  if (box === undefined) throw new Error('design/assets/containers/box.svg is missing')
  return box
}

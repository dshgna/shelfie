// The skincare routine: its steps in order, which items fill each step, and how many steps are
// covered. Ported from the prototype's STEPS and routineHtml. The steps are skincare's default
// groups that start with "Step" (DEFAULT_GROUPS in item.ts); other skincare items, such as an eye
// cream, are extras shown after the steps.

import type { IsoDate } from './dates'
import { DEFAULT_GROUPS, type Group, type Item } from './item'
import { status } from './status'

/** The routine's steps, in order: "Step 1 · Oil Cleanser" to "Step 7 · Sun Protection". */
export const ROUTINE_STEPS: readonly Group[] = DEFAULT_GROUPS.skincare.filter((group) =>
  group.startsWith('Step '),
)

export interface RoutineStep {
  group: Group
  /** The skincare items on this step, in the order they were given. */
  items: Item[]
  /** True when at least one of them is in stock and not expired (prototype `covered`). */
  covered: boolean
}

export interface Routine {
  steps: RoutineStep[]
  /** Skincare items that are on no step, in the order they were given. */
  extras: Item[]
  /** How many steps are covered. */
  covered: number
}

/**
 * True for an item that covers its step: at least one in stock and not expired. An item expiring
 * soon still covers it. Uses status(), so a corrupt date throws as it does there.
 */
export function coversStep(item: Item, today: IsoDate): boolean {
  return item.quantity > 0 && status(item, today) !== 'expired'
}

/**
 * The routine for a household's items. Only skincare items count; deleted ones are left out.
 * Pass the items in the order they should be shown within each step (the UI sorts).
 */
export function routineFor(items: readonly Item[], today: IsoDate): Routine {
  const skincare = items.filter((item) => item.category === 'skincare' && !item.deleted)
  const steps = ROUTINE_STEPS.map((group) => {
    const inStep = skincare.filter((item) => item.group === group)
    return { group, items: inStep, covered: inStep.some((item) => coversStep(item, today)) }
  })
  return {
    steps,
    extras: skincare.filter((item) => !ROUTINE_STEPS.includes(item.group)),
    covered: steps.filter((step) => step.covered).length,
  }
}

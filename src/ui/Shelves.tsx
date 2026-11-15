import { useId } from 'react'
import { Button } from 'react-aria-components'
import type { IsoDate } from '../domain/dates'
import type { Group, Item } from '../domain/item'
import { ROUTINE_STEPS, type Routine } from '../domain/routine'
import { ItemRow } from './ItemRow'
import type { CategoryShelves } from './shelf-view'

export interface RoutineOptions {
  /** The routine for every item, from routineFor (the counts ignore filters, as in the prototype). */
  routine: Routine
  /** Search or a filter is on: steps with no matching item are left out, gaps included. */
  filtersActive: boolean
  /** The section tab shows skincare at all. */
  visible: boolean
  /** "Add a product" on an empty step. */
  onAddToStep: (group: Group) => void
}

interface ShelvesProps {
  categories: readonly CategoryShelves[]
  /** True when there are no items at all, not just none that match. */
  empty: boolean
  today: IsoDate
  onChange: (id: string, delta: 1 | -1) => void
  onOpen: (item: Item) => void
  routine: RoutineOptions
}

/**
 * The skincare routine, in place of the plain Skincare category: each step in order with its
 * items (each labelled with its step and showing its status chip), an empty step as a dashed
 * "Gap" card, then skincare items on no step. Ported from the prototype's routineHtml.
 */
function RoutineSection({
  options,
  shown,
  today,
  onChange,
  onOpen,
}: {
  options: RoutineOptions
  /** The skincare items that match search and filters, in the order to show them. */
  shown: readonly Item[]
  today: IsoDate
  onChange: ShelvesProps['onChange']
  onOpen: ShelvesProps['onOpen']
}) {
  const headingId = useId()
  const { routine, filtersActive, onAddToStep } = options
  const total = ROUTINE_STEPS.length
  const order = new Map(shown.map((item, index) => [item.id, index]))
  const visibleOf = (items: readonly Item[]) =>
    items
      .filter((item) => order.has(item.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  const row = (item: Item, eyebrow: string) => (
    <ItemRow
      key={item.id}
      item={item}
      today={today}
      onChange={onChange}
      onOpen={onOpen}
      eyebrow={eyebrow}
      showStatus
    />
  )

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={headingId} className="font-display text-xl font-semibold md:text-[22px]">
          Skincare Routine
        </h2>
        <p className="text-sm text-muted">
          {routine.covered === total
            ? `All ${total} steps covered. Glow mode on!`
            : `${routine.covered} of ${total} steps stocked. ${total - routine.covered} to go for the full Korean routine.`}
        </p>
      </div>
      <ul className="grid gap-2.5 lg:grid-cols-2">
        {routine.steps.flatMap((step) => {
          const items = visibleOf(step.items)
          if (items.length > 0) return items.map((item) => row(item, step.group))
          if (filtersActive) return []
          return [
            <li
              key={step.group}
              className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-edge p-3"
            >
              <p className="text-xs font-semibold text-muted">{step.group}</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-chip-line bg-chip-bg px-2.5 py-0.5 text-[13px] font-semibold text-danger">
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    aria-hidden="true"
                    className="fill-none stroke-current [stroke-width:1.6] [stroke-linecap:round]"
                  >
                    <circle cx="8" cy="8" r="6" />
                    <path d="M5 8h6" />
                  </svg>
                  Gap
                </span>
                <Button
                  aria-label={`Add a product to ${step.group}`}
                  onPress={() => onAddToStep(step.group)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-edge bg-surface px-4 font-semibold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Add a product
                </Button>
              </div>
            </li>,
          ]
        })}
        {visibleOf(routine.extras).map((item) => row(item, item.group || 'Other'))}
      </ul>
    </section>
  )
}

function CategorySection({
  category,
  today,
  onChange,
  onOpen,
}: {
  category: CategoryShelves
  today: IsoDate
  onChange: ShelvesProps['onChange']
  onOpen: ShelvesProps['onOpen']
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="font-display text-xl font-semibold md:text-[22px]">
        {category.label}
      </h2>
      {category.shelves.map((shelf) => (
        <div key={shelf.group} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted">{shelf.group}</h3>
          <ul className="grid gap-2.5 lg:grid-cols-2">
            {shelf.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                today={today}
                onChange={onChange}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/** Items grouped by category, then by shelf. Headings sit on the page: no wooden ledges. */
export function Shelves({ categories, empty, today, onChange, onOpen, routine }: ShelvesProps) {
  if (empty) {
    return (
      <p className="text-muted">
        A blank shelf! Use Fill my shelves to add what you bought and Shelfie will sort it onto your
        shelves.
      </p>
    )
  }
  const skincare = categories.find((category) => category.category === 'skincare')
  // Unfiltered, the routine shows even with no skincare items, so its gaps can be filled.
  const showRoutine = routine.visible && (skincare !== undefined || !routine.filtersActive)
  if (categories.length === 0 && !showRoutine) {
    return <p className="text-muted">Nothing matches those filters. Try loosening them a little.</p>
  }
  const shownSkincare = skincare?.shelves.flatMap((shelf) => shelf.items) ?? []
  return (
    <div className="flex flex-col gap-6">
      {showRoutine && (
        <RoutineSection
          options={routine}
          shown={shownSkincare}
          today={today}
          onChange={onChange}
          onOpen={onOpen}
        />
      )}
      {categories
        .filter((category) => category.category !== 'skincare')
        .map((category) => (
          <CategorySection
            key={category.category}
            category={category}
            today={today}
            onChange={onChange}
            onOpen={onOpen}
          />
        ))}
    </div>
  )
}

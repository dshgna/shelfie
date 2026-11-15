import { useId } from 'react'
import type { IsoDate } from '../domain/dates'
import type { Item } from '../domain/item'
import { ItemRow } from './ItemRow'
import type { CategoryShelves } from './shelf-view'

interface ShelvesProps {
  categories: readonly CategoryShelves[]
  /** True when there are no items at all, not just none that match. */
  empty: boolean
  today: IsoDate
  onChange: (id: string, delta: 1 | -1) => void
  onOpen: (item: Item) => void
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
export function Shelves({ categories, empty, today, onChange, onOpen }: ShelvesProps) {
  if (empty) {
    return (
      <p className="text-muted">
        A blank shelf! Use Fill my shelves to add what you bought and Shelfie will sort it onto your
        shelves.
      </p>
    )
  }
  if (categories.length === 0) {
    return <p className="text-muted">Nothing matches those filters. Try loosening them a little.</p>
  }
  return (
    <div className="flex flex-col gap-6">
      {categories.map((category) => (
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

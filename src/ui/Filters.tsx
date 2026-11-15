// The inventory filters, ported from the prototype: a "Needs attention" toggle, and a "Filter"
// button that opens Show, Where, Brand and Sort. The list they filter comes in a later step.

import { useId } from 'react'
import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  ToggleButton,
  type Key,
} from 'react-aria-components'

export type ShowFilter = 'all' | 'attention' | 'restock' | 'expiring'
export type SortOrder = 'name' | 'stock' | 'expiry'

export interface FilterState {
  show: ShowFilter
  /** A location, or 'all'. */
  place: string
  /** A brand, or 'all'. */
  brand: string
  sort: SortOrder
}

export const NO_FILTERS: FilterState = { show: 'all', place: 'all', brand: 'all', sort: 'name' }

const PILL =
  'inline-flex min-h-[44px] items-center gap-1 rounded-full border px-3.5 font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const pill = (on: boolean) =>
  `${PILL} ${on ? 'border-ink bg-ink text-bg' : 'border-edge bg-surface text-muted hover:text-ink'}`

interface Option {
  id: string
  label: string
}

function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly Option[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select
      value={value}
      onChange={(key: Key | null) => {
        if (key !== null) onChange(String(key))
      }}
      className="min-w-0"
    >
      <Label className="sr-only">{label}</Label>
      <Button className="flex min-h-[44px] w-full items-center justify-between gap-2 border-b border-edge px-0.5 text-left text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <SelectValue className="truncate" />
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
          className="flex-none fill-none stroke-current [stroke-width:1.8] [stroke-linecap:round]"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </Button>
      <Popover className="min-w-(--trigger-width) rounded-xl border border-line bg-surface p-1 shadow-lg">
        <ListBox items={options} className="max-h-72 overflow-auto outline-none">
          {(option) => (
            <ListBoxItem
              id={option.id}
              className="flex min-h-[44px] cursor-default items-center rounded-lg px-3 outline-none data-focused:bg-surface-2 data-selected:font-semibold data-selected:text-ink"
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  )
}

const SHOW_OPTIONS: readonly Option[] = [
  { id: 'all', label: 'Everything' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'restock', label: 'Needs restocking' },
  { id: 'expiring', label: 'Expiring or expired' },
]

const SORT_OPTIONS: readonly Option[] = [
  { id: 'name', label: 'Sort: name' },
  { id: 'stock', label: 'Sort: lowest stock' },
  { id: 'expiry', label: 'Sort: soonest expiry' },
]

interface FiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  attention: number
  places: readonly string[]
  brands: readonly string[]
  panelOpen: boolean
  onPanelOpenChange: (open: boolean) => void
}

export function Filters({
  filters,
  onChange,
  attention,
  places,
  brands,
  panelOpen,
  onPanelOpenChange,
}: FiltersProps) {
  const panelId = useId()
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })
  const active =
    (filters.show !== 'all' && filters.show !== 'attention' ? 1 : 0) +
    (filters.place !== 'all' ? 1 : 0) +
    (filters.brand !== 'all' ? 1 : 0) +
    (filters.sort !== 'name' ? 1 : 0)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <ToggleButton
          isSelected={filters.show === 'attention'}
          onChange={(on) => set({ show: on ? 'attention' : 'all' })}
          className={({ isSelected }) => pill(isSelected)}
        >
          Needs attention <span className="ml-1 text-[0.78rem] opacity-80">{attention}</span>
        </ToggleButton>
        <Button
          aria-expanded={panelOpen}
          aria-controls={panelId}
          onPress={() => onPanelOpenChange(!panelOpen)}
          className={pill(panelOpen)}
        >
          Filter
          {active > 0 && <span className="ml-1 text-[0.78rem] opacity-80">{active}</span>}
        </Button>
      </div>
      <div
        id={panelId}
        hidden={!panelOpen}
        className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4"
      >
        <FilterSelect
          label="Show"
          options={SHOW_OPTIONS}
          value={filters.show}
          onChange={(show) => set({ show: show as ShowFilter })}
        />
        <FilterSelect
          label="Where"
          options={[
            { id: 'all', label: 'All places' },
            ...places.map((place) => ({ id: place, label: place })),
          ]}
          value={filters.place}
          onChange={(place) => set({ place })}
        />
        <FilterSelect
          label="Brand"
          options={[
            { id: 'all', label: 'All brands' },
            ...brands.map((brand) => ({ id: brand, label: brand })),
          ]}
          value={filters.brand}
          onChange={(brand) => set({ brand })}
        />
        <FilterSelect
          label="Sort by"
          options={SORT_OPTIONS}
          value={filters.sort}
          onChange={(sort) => set({ sort: sort as SortOrder })}
        />
      </div>
    </div>
  )
}

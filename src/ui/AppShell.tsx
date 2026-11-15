// The app shell: header, stats, the Inventory and Shopping tabs, shelf sections and filters.
// It reads and writes items only through ItemRepository. The Inventory panel shows the shelves;
// the Shopping panel stays empty until the shopping list is built.

import { useMemo, useState } from 'react'
import { Tab, TabList, TabPanel, Tabs, type Key } from 'react-aria-components'
import { startOfToday } from '../domain/dates'
import { needsExpiry, needsRestock } from '../domain/status'
import type { ItemRepository } from '../storage/repository'
import { Filters, NO_FILTERS, type FilterState, type ShowFilter } from './Filters'
import { Header } from './Header'
import { ItemEditor, type EditorTarget } from './ItemEditor'
import { Leaves } from './Leaves'
import { SECTIONS, type SectionKey } from './sections'
import { Shelves } from './Shelves'
import { ShoppingTab, type ShoppingState } from './ShoppingTab'
import type { ShoppingLine } from './shopping'
import { shelvesFor } from './shelf-view'
import { StatsHeader } from './StatsHeader'
import { useChangeQuantity } from './useChangeQuantity'
import { useItems } from './useItems'

type Page = 'inventory' | 'shopping'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const PAGE_TAB = `-mb-px inline-flex min-h-[44px] cursor-default items-center gap-2 border-b-3 px-4 py-3 text-base font-semibold ${FOCUS}`

const SECTION_TAB = `inline-flex min-h-[44px] flex-none cursor-default items-center gap-1.5 rounded-full border px-4 font-display text-[15px] ${FOCUS}`

function Sprout() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        className="fill-none stroke-sprout [stroke-width:2] [stroke-linecap:round]"
        d="M12 21v-8"
      />
      <ellipse
        className="fill-sprout"
        cx="8"
        cy="10"
        rx="5"
        ry="2.8"
        transform="rotate(-28 8 10)"
      />
      <ellipse
        className="fill-sprout"
        cx="16.5"
        cy="8.5"
        rx="5"
        ry="2.8"
        transform="rotate(28 16.5 8.5)"
      />
    </svg>
  )
}

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].filter((v) => v !== '').sort((a, b) => a.localeCompare(b))
}

interface AppShellProps {
  repository: ItemRepository
  householdId: string
}

export function AppShell({ repository, householdId }: AppShellProps) {
  const items = useItems(repository, householdId)
  const changeQuantity = useChangeQuantity(repository)
  const [page, setPage] = useState<Page>('inventory')
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)
  // Kept here, not in the tab, so ticks and numbers survive switching tabs (as in the prototype).
  const [shopping, setShopping] = useState<ShoppingState>({ buy: {}, checked: new Set() })

  const restock = async (lines: readonly ShoppingLine[]): Promise<number> => {
    let saved = 0
    for (const line of lines) {
      if (await changeQuantity(line.item.id, line.buy)) saved += 1
    }
    // As in the prototype: the restocked lines forget their numbers, and every tick is cleared.
    const done = new Set(lines.map((line) => line.item.id))
    setShopping((current) => ({
      buy: Object.fromEntries(Object.entries(current.buy).filter(([id]) => !done.has(id))),
      checked: new Set(),
    }))
    return saved
  }
  const [section, setSection] = useState<SectionKey | 'all'>('all')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS)
  const [panelOpen, setPanelOpen] = useState(false)

  const today = startOfToday(new Date())
  const stats = useMemo(() => {
    const restock = items.filter((item) => needsRestock(item, today)).length
    const expiring = items.filter((item) => needsExpiry(item, today)).length
    const attention = items.filter(
      (item) => needsRestock(item, today) || needsExpiry(item, today),
    ).length
    const sectionCounts = new Map(
      SECTIONS.map((s) => [
        s.key,
        items.filter((item) => s.categories.includes(item.category)).length,
      ]),
    )
    return { restock, expiring, attention, sectionCounts }
  }, [items, today])

  const categories = useMemo(
    () => shelvesFor(items, { query, section, filters }, today),
    [items, query, section, filters, today],
  )

  const places = useMemo(() => sorted(items.map((item) => item.location)), [items])
  const brands = useMemo(() => sorted(items.map((item) => item.brand)), [items])

  // The stats chips set the Show filter, as in the prototype, and bring Inventory forward.
  const show = (value: ShowFilter) => {
    setFilters({ ...filters, show: value })
    setPage('inventory')
    if (value !== 'all' && value !== 'attention') setPanelOpen(true)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[70rem] flex-col gap-3.5 px-4 pt-3.5 pb-14 md:gap-5 md:px-8 md:pt-8">
      <Leaves />
      <Header query={query} onQueryChange={setQuery} onShopNow={() => setPage('shopping')} />
      <main className="flex flex-col gap-3.5 md:gap-5">
        <StatsHeader
          total={items.length}
          restock={stats.restock}
          expiring={stats.expiring}
          attention={stats.attention}
          onShow={show}
        />
        <Tabs selectedKey={page} onSelectionChange={(key: Key) => setPage(key as Page)}>
          <TabList aria-label="Pages" className="flex gap-1 border-b border-line">
            <Tab
              id="inventory"
              className={({ isSelected }) =>
                `${PAGE_TAB} ${isSelected ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`
              }
            >
              Inventory
              <span className="text-xs font-medium opacity-60">{items.length}</span>
            </Tab>
            <Tab
              id="shopping"
              className={({ isSelected }) =>
                `${PAGE_TAB} ${isSelected ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`
              }
            >
              Shopping
              <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[13px] text-warn">
                {stats.restock}
                <span className="sr-only"> items to buy</span>
              </span>
            </Tab>
          </TabList>

          <TabPanel id="inventory" className={`flex flex-col gap-3.5 pt-3.5 md:gap-4 ${FOCUS}`}>
            <Tabs
              selectedKey={section}
              onSelectionChange={(key: Key) => setSection(key as SectionKey | 'all')}
              className="flex flex-col gap-3.5"
            >
              <TabList
                aria-label="Shelves"
                className="-mr-4 flex [scrollbar-width:none] gap-2 overflow-x-auto p-0.5 pr-4 md:mr-0 md:flex-wrap md:pr-0.5"
              >
                {[
                  { key: 'all' as const, label: 'All', count: items.length },
                  ...SECTIONS.map((s) => ({
                    key: s.key,
                    label: s.label,
                    count: stats.sectionCounts.get(s.key) ?? 0,
                  })),
                ].map(({ key, label, count }) => (
                  <Tab
                    key={key}
                    id={key}
                    className={({ isSelected }) =>
                      `${SECTION_TAB} ${
                        isSelected
                          ? 'border-2 border-sprout bg-eu-20 pl-3 font-semibold text-sprout-deep'
                          : 'border-line bg-surface font-medium text-ink'
                      }`
                    }
                  >
                    {({ isSelected }) => (
                      <>
                        {isSelected && <Sprout />}
                        {label}
                        <span className="font-body text-xs font-semibold opacity-75">{count}</span>
                      </>
                    )}
                  </Tab>
                ))}
              </TabList>
              <Filters
                filters={filters}
                onChange={setFilters}
                attention={stats.attention}
                places={places}
                brands={brands}
                panelOpen={panelOpen}
                onPanelOpenChange={setPanelOpen}
              />
              {['all', ...SECTIONS.map((s) => s.key)].map((key) => (
                <TabPanel key={key} id={key} className={FOCUS}>
                  <Shelves
                    categories={categories}
                    empty={items.length === 0}
                    today={today}
                    onChange={changeQuantity}
                    onOpen={(item) => setEditorTarget({ kind: 'edit', item })}
                  />
                </TabPanel>
              ))}
            </Tabs>
          </TabPanel>
          <TabPanel id="shopping" className={`pt-3.5 ${FOCUS}`}>
            <ShoppingTab
              items={items}
              today={today}
              state={shopping}
              onBuyChange={(id, buy) =>
                setShopping((current) => ({ ...current, buy: { ...current.buy, [id]: buy } }))
              }
              onCheckedChange={(id, on) =>
                setShopping((current) => {
                  const checked = new Set(current.checked)
                  if (on) checked.add(id)
                  else checked.delete(id)
                  return { ...current, checked }
                })
              }
              onRestock={restock}
            />
          </TabPanel>
        </Tabs>
      </main>
      {editorTarget && (
        <ItemEditor
          key={editorTarget.kind === 'edit' ? editorTarget.item.id : 'new'}
          target={editorTarget}
          repository={repository}
          today={today}
          onClose={() => setEditorTarget(null)}
        />
      )}
    </div>
  )
}

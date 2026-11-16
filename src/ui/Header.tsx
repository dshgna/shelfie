import { Input, Label, SearchField } from 'react-aria-components'
import { MainActions } from './MainActions'
import { ThemeButton } from './ThemeButton'

/** The small jar beside the wordmark (the design canvas's logo mark, no ledge). */
function LogoJar() {
  return (
    <svg viewBox="0 0 120 120" className="block size-[34px] md:size-[44px]" aria-hidden="true">
      <path
        className="fill-none stroke-sprout [stroke-width:6] [stroke-linecap:round]"
        d="M60 30 L60 16"
      />
      <ellipse
        className="fill-sprout"
        cx="48"
        cy="14"
        rx="13"
        ry="7"
        transform="rotate(-24 48 14)"
      />
      <ellipse
        className="fill-sprout"
        cx="72"
        cy="11"
        rx="13"
        ry="7"
        transform="rotate(24 72 11)"
      />
      <rect className="fill-wood" x="32" y="28" width="56" height="16" rx="7" />
      <rect className="fill-eu" x="24" y="40" width="72" height="74" rx="26" />
      <ellipse className="fill-ink" cx="49" cy="66" rx="4" ry="5.5" />
      <ellipse className="fill-ink" cx="71" cy="66" rx="4" ry="5.5" />
      <path
        className="fill-none stroke-ink [stroke-width:3.5] [stroke-linecap:round]"
        d="M53 78 Q60 85 67 78"
      />
      <rect className="fill-cream" x="38" y="90" width="44" height="12" rx="6" />
    </svg>
  )
}

interface HeaderProps {
  query: string
  onQueryChange: (query: string) => void
  onShopNow: () => void
  onFill: () => void
}

export function Header({ query, onQueryChange, onShopNow, onFill }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="mr-auto flex items-center gap-2 md:gap-2.5">
        <LogoJar />
        <h1 className="font-display text-2xl leading-none font-semibold tracking-tight md:text-[30px]">
          Shelfie
        </h1>
      </div>
      <div className="md:order-last">
        <ThemeButton />
      </div>
      <SearchField
        value={query}
        onChange={onQueryChange}
        className="flex h-[44px] w-full items-center gap-2 rounded-xl border border-edge bg-surface px-3 text-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent md:w-[300px]"
      >
        <Label className="sr-only">Search</Label>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          className="flex-none fill-none stroke-current [stroke-width:2] [stroke-linecap:round]"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <Input
          placeholder="Search items, shelves or notes"
          className="-my-px min-w-0 flex-1 self-stretch bg-transparent text-base text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
      </SearchField>
      <MainActions onFill={onFill} onShopNow={onShopNow} />
    </header>
  )
}

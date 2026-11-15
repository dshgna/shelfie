import { useState } from 'react'
import { Button } from 'react-aria-components'

type Theme = 'system' | 'light' | 'dark'

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }

function applyTheme(theme: Theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

/** Cycles system, light and dark. Kept from the foundation shell until Settings exists. */
export function ThemeButton() {
  const [theme, setTheme] = useState<Theme>('system')
  return (
    <Button
      className="min-h-[44px] rounded-xl border border-edge bg-surface px-3.5 font-semibold hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-pressed:bg-surface-2"
      onPress={() => {
        const next = NEXT[theme]
        setTheme(next)
        applyTheme(next)
      }}
    >
      Theme: {theme}
    </Button>
  )
}

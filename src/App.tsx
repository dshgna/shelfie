import { useState } from 'react'
import { Button } from 'react-aria-components'

type Theme = 'system' | 'light' | 'dark'

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }

function applyTheme(theme: Theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

/**
 * Foundation shell only. Steps 2-4 replace this with the real app:
 * domain logic (step 2), local storage (step 3), then the shelves UI (step 4).
 */
export default function App() {
  const [theme, setTheme] = useState<Theme>('system')

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-4 py-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Shelfie</h1>
          <p className="text-muted">Your shelves stay on your device.</p>
        </div>
        <Button
          className="min-h-10 rounded-lg border border-line bg-surface px-3.5 font-semibold hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-pressed:bg-surface-2"
          onPress={() => {
            const next = NEXT[theme]
            setTheme(next)
            applyTheme(next)
          }}
        >
          Theme: {theme}
        </Button>
      </header>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Foundation ready</h2>
        <p className="text-muted">
          Build, tests, offline install and the privacy policy are wired up. The shelves come next.
        </p>
      </section>
    </main>
  )
}

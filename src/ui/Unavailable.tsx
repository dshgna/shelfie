// The plain screen shown when Shelfie can't start: a build without its Supabase settings, or an
// error while drawing the page. Wordmark, the jar, one sentence; never technical text, variable
// names or error details (those go to the console only, for the owner).

import { LogoJar } from './Header'
import { Leaves } from './Leaves'
import { Mascot } from './Mascot'

export const UNAVAILABLE_MESSAGE = "Shelfie can't start right now. Please try again later."

export function Unavailable() {
  return (
    <div className="relative min-h-dvh">
      <Leaves />
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <div className="flex items-center gap-2.5">
          <LogoJar className="size-10" />
          <span className="font-display text-[28px] leading-none font-semibold">Shelfie</span>
        </div>
        <Mascot mood="sleepy" gauge={50} onLedge className="w-[120px]" />
        <h1 className="m-0 font-display text-2xl leading-snug font-semibold">
          {UNAVAILABLE_MESSAGE}
        </h1>
      </main>
    </div>
  )
}

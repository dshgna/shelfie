// The frame of the sign-in screens, from prototype-create-account-sign-in.html.
// - Wide (1024px and up): the brand panel on the left (wordmark, jar, headline, subhead, four
//   benefits, privacy line; copy exactly as the design) and a card on the right.
// - Narrow: the phone layout, one column. Create account opens with the wordmark, the jar and the
//   headline (PhoneHero); the other screens have a bar with a back button and a title, and the jar
//   saying one line (PhoneBar).
// The layout is chosen in JavaScript (useWide), so each width renders only its own headings and
// controls and the keyboard order always follows what is on screen.

import { useEffect, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { Button } from 'react-aria-components'
import { LogoJar } from '../Header'
import { Leaves } from '../Leaves'
import { Mascot } from '../Mascot'
import { FOCUS } from './styles'

export const WIDE_QUERY = '(min-width: 1024px)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function isWide(): boolean {
  return (
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE_QUERY).matches
  )
}

/** True at 1024px and wider: the web entry page with the brand panel. */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, isWide, () => false)
}

/** Moves focus to the element once, after it mounts, when `enabled`. */
export function useFocusOnMount(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (enabled) ref.current?.focus()
    // Only on mount: later renders must not pull focus back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

function Wordmark({ size }: { size: 'phone' | 'web' }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoJar className={size === 'web' ? 'size-11' : 'size-9'} />
      <span
        className={`font-display leading-none font-semibold ${size === 'web' ? 'text-[30px]' : 'text-[26px]'}`}
      >
        Shelfie
      </span>
    </div>
  )
}

const HEADLINE = 'Stop keeping the bathroom cabinet in your head.'

const BENEFITS = [
  'Fill your shelves from your orders',
  "Know what's running low",
  'Swap to greener products',
  'Restock on time',
]

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      className="flex-none fill-none stroke-current [stroke-width:2] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.8" />
    </svg>
  )
}

export function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className="flex-none fill-none stroke-current [stroke-width:2] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

function BrandPanel() {
  return (
    <section aria-label="About Shelfie" className="flex flex-col gap-5">
      <Wordmark size="web" />
      <Mascot mood="happy" gauge={80} onLedge className="w-[150px]" />
      <h1 className="m-0 max-w-[16ch] font-display text-[44px] leading-[1.1] font-semibold">
        {HEADLINE}
      </h1>
      <p className="m-0 max-w-[34rem] text-[19px] leading-normal text-muted">
        Shelfie remembers what you have, what's running low and manages your shopping for you.
      </p>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2.5 text-base font-medium text-ink">
            <span className="flex text-sprout-deep">
              <CheckIcon />
            </span>
            {benefit}
          </li>
        ))}
      </ul>
      <p className="m-0 flex max-w-[34rem] gap-2 text-sm text-muted">
        <span className="text-accent">
          <LockIcon />
        </span>
        Your items live on your device. If you sync, they're encrypted first, so our server can't
        read them.
      </p>
    </section>
  )
}

export function AuthLayout({ wide, children }: { wide: boolean; children: ReactNode }) {
  if (wide) {
    return (
      <div className="relative min-h-dvh">
        <Leaves />
        <div className="mx-auto grid min-h-dvh max-w-[72rem] grid-cols-[minmax(0,1fr)_480px] items-center gap-14 px-8 pt-7 pb-10">
          <BrandPanel />
          <main className="flex flex-col gap-[18px] rounded-3xl border border-ink/15 bg-surface p-6 shadow-xl shadow-ink/10">
            {children}
          </main>
        </div>
      </div>
    )
  }
  return (
    <div className="relative min-h-dvh">
      <Leaves />
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4">{children}</main>
    </div>
  )
}

/** Phone create account: wordmark, the happy jar beside the headline, then the form's heading. */
export function PhoneHero({
  heading,
  headingRef,
  children,
}: {
  heading: string
  headingRef?: RefObject<HTMLHeadingElement | null>
  children: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-7">
      <Wordmark size="phone" />
      <div className="flex items-end gap-3.5">
        <Mascot mood="happy" gauge={80} onLedge className="w-[92px] flex-none" />
        <h1 className="m-0 mb-2 font-display text-2xl leading-[1.15] font-semibold">{HEADLINE}</h1>
      </div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="m-0 mt-1.5 font-display text-xl leading-tight font-semibold outline-none"
      >
        {heading}
      </h2>
      {children}
    </div>
  )
}

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      className="fill-none stroke-current [stroke-width:2] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

/** The jar with a speech bubble, as on the phone screens. */
function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-none items-end gap-2.5">
      <Mascot mood="happy" gauge={80} className="w-[58px] flex-none" />
      <p className="m-0 mb-3.5 rounded-[16px_16px_16px_4px] border border-ink/15 bg-surface px-3.5 py-2.5 text-[15px] leading-snug font-medium text-ink">
        {children}
      </p>
    </div>
  )
}

/** Phone screens after the first: back button and title, then the jar saying one line. */
export function PhoneBar({
  title,
  backLabel,
  onBack,
  bubble,
  headingRef,
  children,
}: {
  title: string
  backLabel: string
  onBack: () => void
  bubble: ReactNode
  headingRef?: RefObject<HTMLHeadingElement | null>
  children: ReactNode
}) {
  return (
    <>
      <div className="flex flex-none items-center gap-2.5 px-4 pt-3.5 pb-2">
        <Button
          aria-label={backLabel}
          onPress={onBack}
          className={`grid size-[44px] flex-none place-items-center rounded-xl border border-edge bg-surface text-ink data-hovered:bg-surface-2 ${FOCUS}`}
        >
          <BackIcon />
        </Button>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="m-0 flex-1 font-display text-[22px] leading-tight font-semibold outline-none"
        >
          {title}
        </h1>
      </div>
      <div className="flex flex-1 flex-col gap-4 px-4 pt-2 pb-6">
        <Bubble>{bubble}</Bubble>
        {children}
      </div>
    </>
  )
}

/** The web card's title, with an optional line under it. */
export function CardTitle({
  title,
  intro,
  headingRef,
}: {
  title: string
  intro?: ReactNode
  headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="m-0 font-display text-[26px] leading-[1.15] font-semibold outline-none"
      >
        {title}
      </h2>
      {intro && <p className="m-0 -mt-2 text-[15px] text-muted">{intro}</p>}
    </>
  )
}

/**
 * The form's error summary: empty until a submit fails, then the problem in plain words. A polite
 * live region (not an alert), focused on a failed submit so keyboard and screen reader users land
 * on it.
 */
export function FormProblem({
  message,
  problemRef,
}: {
  message: string | undefined
  problemRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      ref={problemRef}
      tabIndex={-1}
      aria-live="polite"
      className={
        message
          ? `rounded-xl border border-danger bg-surface px-3.5 py-3 text-[15px] font-semibold text-danger ${FOCUS}`
          : 'sr-only'
      }
    >
      {message}
    </div>
  )
}

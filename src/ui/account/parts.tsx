// Building blocks of Account settings, from the design: white section cards with an icon and a
// Fredoka heading, rows divided by a hairline, and the confirm dialog.

import type { ReactNode } from 'react'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { FOCUS } from '../auth/styles'

/** A smaller main action (Save, Sign in) beside Cancel. */
export const ACCENT_BUTTON = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-accent bg-accent px-4 text-base font-semibold text-surface data-disabled:opacity-60 data-hovered:opacity-90 ${FOCUS}`

export const DANGER_OUTLINE = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-danger bg-transparent px-4 text-base font-semibold text-danger data-disabled:opacity-60 data-hovered:bg-surface-2 ${FOCUS}`

const OVERLAY = 'fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-bg/80 p-4'
const PANEL = 'w-full max-w-sm rounded-3xl border border-line bg-surface p-5 md:p-6'

const ICON =
  'fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]'

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className={ICON}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className={ICON}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  )
}

export function DevicesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className={ICON}>
      <rect x="2" y="5" width="14" height="10" rx="1.5" />
      <path d="M1 18h16" />
      <rect x="17" y="8" width="6" height="12" rx="1.5" />
    </svg>
  )
}

export function DataIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className={ICON}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  )
}

export function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={ICON}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 rounded-[18px] border border-ink/15 bg-surface px-[18px] py-4">
      <div className="flex items-center gap-2.5">
        <span className="flex text-accent">{icon}</span>
        <h2 className="m-0 flex-1 font-display text-xl leading-tight font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

/** One row: title and detail on the left, an action on the right, and room for a form below. */
export function Row({
  title,
  detail,
  action,
  children,
}: {
  title: ReactNode
  detail?: ReactNode
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col border-t border-ink/15">
      <div className="flex min-h-14 flex-wrap items-center gap-3 py-2">
        <div className="flex min-w-[180px] flex-1 flex-col gap-[3px]">
          <span className="text-[15px] leading-tight font-semibold">{title}</span>
          {detail && <span className="text-sm text-muted">{detail}</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

/** A confirm dialog (alertdialog). React Aria keeps focus inside and returns it on close. */
export function ConfirmDialog({
  title,
  isOpen,
  onOpenChange,
  children,
}: {
  title: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children: (close: () => void) => ReactNode
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className={OVERLAY}>
      <Modal className={PANEL}>
        <Dialog role="alertdialog" className="flex flex-col gap-3 outline-none">
          {({ close }) => (
            <>
              <Heading slot="title" className="m-0 font-display text-xl font-semibold">
                {title}
              </Heading>
              {children(close)}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

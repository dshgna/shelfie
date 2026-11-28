// "Generate password" and "Copy" (and, on the phone design, "Clear"): teal-outline pills under a
// new-password field. They look 36px tall, but each button is 44px tall (the pill is drawn inside
// it), so the touch area meets the 44px rule. Copy says "Copied" for 2 seconds, in a polite live
// region. Copy and Clear are off while the field is empty.

import { useEffect, useState } from 'react'
import { Button } from 'react-aria-components'

const PILL_BUTTON =
  'group inline-flex min-h-[44px] items-center rounded-full outline-none data-disabled:opacity-50'
const PILL =
  'inline-flex h-9 items-center rounded-full border border-accent bg-surface text-sm leading-none font-semibold whitespace-nowrap text-accent group-data-hovered:bg-surface-2 group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-accent'

const ICON = 'flex-none fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round]'

export const COPIED_FOR_MS = 2000

export interface PasswordToolsProps {
  value: string
  onGenerate: () => void
  /** Writes text to the clipboard. The app passes navigator.clipboard.writeText. */
  writeClipboard?: (text: string) => Promise<void>
  /** Shows "Clear", which empties the field (the phone design). */
  onClear?: () => void
}

const browserClipboard = (text: string) => navigator.clipboard.writeText(text)

export function PasswordTools({
  value,
  onGenerate,
  writeClipboard = browserClipboard,
  onClear,
}: PasswordToolsProps) {
  // Three pills fit a phone's width with the design's tighter padding.
  const pill = `${PILL} ${onClear ? 'gap-1 px-2.5' : 'gap-1.5 px-3.5'}`
  const [note, setNote] = useState('')

  useEffect(() => {
    if (note === '') return
    const timer = setTimeout(() => setNote(''), COPIED_FOR_MS)
    return () => clearTimeout(timer)
  }, [note])

  const copy = async () => {
    try {
      await writeClipboard(value)
      setNote('Copied')
    } catch {
      setNote("Couldn't copy. Select the password and copy it.")
    }
  }

  return (
    <span className={`flex flex-wrap items-center ${onClear ? 'gap-x-1.5' : 'gap-x-2'}`}>
      <Button className={PILL_BUTTON} onPress={onGenerate}>
        <span className={pill}>
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            aria-hidden="true"
            className={`${ICON} [stroke-width:2.2]`}
          >
            <path d="M20 11a8 8 0 1 0-2.3 5.7" />
            <path d="M20 4v7h-7" />
          </svg>
          Generate password
        </span>
      </Button>
      <Button className={PILL_BUTTON} onPress={() => void copy()} isDisabled={value === ''}>
        <span className={pill}>
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            aria-hidden="true"
            className={`${ICON} [stroke-width:2]`}
          >
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
          </svg>
          Copy
        </span>
      </Button>
      {onClear && (
        <Button className={PILL_BUTTON} onPress={onClear} isDisabled={value === ''}>
          <span className={pill}>
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              aria-hidden="true"
              className={`${ICON} [stroke-width:2.2]`}
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Clear
          </span>
        </Button>
      )}
      <span role="status" className="text-sm font-semibold text-sprout-deep">
        {note}
      </span>
    </span>
  )
}

// Form fields shared by the item editor and the Fill my shelves review editor: a labelled text
// field with its message, and a labelled select. React Aria components, 44px tall.

import type { ReactNode, RefObject } from 'react'
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Text,
  TextField,
  type Key,
} from 'react-aria-components'
import { CATEGORIES } from '../domain/item'
import { CATEGORY_LABELS } from './shelf-view'

export const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
export const INPUT = `min-h-[44px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink data-invalid:border-danger ${FOCUS}`
export const BUTTON = `inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 font-semibold ${FOCUS}`
export const SECONDARY = `${BUTTON} border-edge bg-surface text-ink hover:bg-surface-2`
export const DANGER = `${BUTTON} border-danger bg-surface text-danger hover:bg-surface-2`

export interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  description?: ReactNode
  inputRef?: RefObject<HTMLInputElement | null>
  type?: 'text' | 'date'
  inputMode?: 'numeric'
  maxLength?: number
  autoFocus?: boolean
}

export function Field({
  label,
  value,
  onChange,
  error,
  description,
  inputRef,
  type,
  inputMode,
  maxLength,
  autoFocus,
}: FieldProps) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      isInvalid={error !== undefined}
      validationBehavior="aria"
      className="flex flex-col gap-1"
    >
      <Label className="text-sm font-semibold">{label}</Label>
      <Input
        ref={inputRef}
        type={type ?? 'text'}
        inputMode={inputMode}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoComplete="off"
        className={INPUT}
      />
      {description && (
        <Text slot="description" className="text-sm text-muted">
          {description}
        </Text>
      )}
      <FieldError className="text-sm font-semibold text-danger">{error}</FieldError>
    </TextField>
  )
}

export function FieldSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  buttonRef,
}: {
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (value: T) => void
  /** To move focus to this field, as "+ Other shelf" does. */
  buttonRef?: RefObject<HTMLButtonElement | null>
}) {
  return (
    <Select
      value={value}
      onChange={(key: Key | null) => {
        if (key !== null) onChange(String(key) as T)
      }}
      className="flex flex-col gap-1"
    >
      <Label className="text-sm font-semibold">{label}</Label>
      <Button
        ref={buttonRef}
        className={`${INPUT} flex items-center justify-between gap-2 text-left`}
      >
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
              className="flex min-h-[44px] cursor-default items-center rounded-lg px-3 outline-none data-focused:bg-surface-2 data-selected:font-semibold"
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  )
}

export const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({
  id: category,
  label: CATEGORY_LABELS[category],
}))

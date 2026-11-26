// The email field and the "Keep me signed in" checkbox, styled as on the design.

import type { RefObject } from 'react'
import { Checkbox, FieldError, Input, Label, TextField } from 'react-aria-components'
import { FOCUS_LABEL } from '../fields'
import { AUTH_INPUT, FIELD_ERROR, LABEL } from './styles'

export function EmailField({
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  inputRef,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error: string | undefined
  /** 'username' on create account and sign in (so password managers pair it), 'email' elsewhere. */
  autoComplete: 'username' | 'email'
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      type="email"
      isInvalid={error !== undefined}
      validationBehavior="aria"
      className="flex min-w-0 flex-col gap-1.5"
    >
      <Label className={LABEL}>Email</Label>
      <Input
        ref={inputRef}
        autoComplete={autoComplete}
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="you@example.com"
        className={`${AUTH_INPUT} placeholder:text-muted`}
      />
      <FieldError className={FIELD_ERROR}>{error}</FieldError>
    </TextField>
  )
}

export function KeepSignedIn({
  isSelected,
  onChange,
  label,
}: {
  isSelected: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <Checkbox
      isSelected={isSelected}
      onChange={onChange}
      className={`group flex min-h-12 cursor-pointer items-center gap-3 rounded-xl ${FOCUS_LABEL}`}
    >
      <span className="grid size-5 flex-none place-items-center rounded border-2 border-accent bg-surface group-data-selected:bg-accent">
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
          className="hidden fill-none stroke-surface [stroke-width:2.5] [stroke-linecap:round] [stroke-linejoin:round] group-data-selected:block"
        >
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
      <span className="text-[15px] leading-tight font-semibold">{label}</span>
    </Checkbox>
  )
}

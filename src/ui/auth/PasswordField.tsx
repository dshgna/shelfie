// A password field with the eye button inside it, from the design: monospace text, a 44px button
// on the right that shows or hides the password (named "Show password" / "Hide password", with
// aria-pressed). Paste is never blocked. The value lives in the form's state only.

import type { RefObject } from 'react'
import { FieldError, Input, Label, TextField, ToggleButton } from 'react-aria-components'
import { AUTH_INPUT, FIELD_ERROR, FOCUS, LABEL } from './styles'

export interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoComplete: 'new-password' | 'current-password'
  revealed: boolean
  onRevealedChange: (revealed: boolean) => void
  error?: string | undefined
  inputRef?: RefObject<HTMLInputElement | null>
  /** Monospace text (the default), so a generated password reads clearly. */
  mono?: boolean
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      className="fill-none stroke-current [stroke-width:2] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  )
}

export function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  revealed,
  onRevealedChange,
  error,
  inputRef,
  mono = true,
}: PasswordFieldProps) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      isInvalid={error !== undefined}
      validationBehavior="aria"
      className="flex flex-col gap-2"
    >
      <Label className={LABEL}>{label}</Label>
      <span className="relative block">
        <Input
          ref={inputRef}
          type={revealed ? 'text' : 'password'}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className={`${AUTH_INPUT} pr-[52px] ${mono ? 'font-mono font-medium' : ''}`}
        />
        <ToggleButton
          isSelected={revealed}
          onChange={onRevealedChange}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          className={`absolute top-0.5 right-0.5 grid size-[44px] place-items-center rounded-[10px] text-ink data-hovered:bg-surface-2 ${FOCUS}`}
        >
          <EyeIcon open={!revealed} />
        </ToggleButton>
      </span>
      <FieldError className={FIELD_ERROR}>{error}</FieldError>
    </TextField>
  )
}

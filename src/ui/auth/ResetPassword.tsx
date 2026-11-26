// Reset password, reached from the email link (/app/reset-password/). Supabase has signed the
// person in from the link, so this sets the new password, signs out every other device (as the
// design's note says), then opens the app.

import { useRef, useState, type FormEvent } from 'react'
import { Button, Form } from 'react-aria-components'
import { generatePassword } from '../../auth/password'
import { useAuth } from '../../auth/useAuth'
import { CardTitle, FormProblem, PhoneBar, useFocusOnMount } from './AuthLayout'
import { PasswordField } from './PasswordField'
import { PasswordTools } from './PasswordTools'
import { PRIMARY } from './styles'
import { useAuthSubmit } from './useAuthSubmit'
import { newPasswordError } from './validation'

export interface ResetPasswordProps {
  wide: boolean
  autoFocus: boolean
  email: string
  onBack: () => void
  onDone: () => void
  writeClipboard?: (text: string) => Promise<void>
  generate?: () => string
}

export function ResetPassword({
  wide,
  autoFocus,
  email,
  onBack,
  onDone,
  writeClipboard,
  generate = generatePassword,
}: ResetPasswordProps) {
  const { updatePassword, signOutOthers } = useAuth()
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const submit = useAuthSubmit()
  const passwordRef = useRef<HTMLInputElement>(null)
  useFocusOnMount(passwordRef, autoFocus)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = newPasswordError(password)
    setError(found)
    if (found) {
      submit.fail(found)
      return
    }
    void submit
      .run(async () => {
        await updatePassword(password)
        // The password is saved; signing the other devices out is best effort.
        await signOutOthers().catch(() => undefined)
      })
      .then((saved) => {
        if (saved) onDone()
      })
  }

  const form = (
    <Form onSubmit={onSubmit} validationBehavior="aria" className="flex flex-col gap-4">
      <FormProblem message={submit.problem} problemRef={submit.problemRef} />
      <div className="flex flex-col gap-0.5">
        <PasswordField
          label="New password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            if (error) setError(newPasswordError(value))
          }}
          onBlur={() => {
            if (password !== '') setError(newPasswordError(password))
          }}
          autoComplete="new-password"
          revealed={revealed}
          onRevealedChange={setRevealed}
          error={error}
          inputRef={passwordRef}
        />
        <PasswordTools
          value={password}
          writeClipboard={writeClipboard}
          onGenerate={() => {
            setPassword(generate())
            setRevealed(true)
            setError(undefined)
          }}
        />
      </div>
      <Button type="submit" isDisabled={submit.pending} className={PRIMARY}>
        Save new password
      </Button>
      <p className="m-0 text-[13px] text-muted">
        You'll be signed out on your other devices. Sign in there with your new password.
      </p>
    </Form>
  )

  if (wide) {
    return (
      <div className="flex flex-col gap-[18px]">
        <CardTitle
          title="Reset Your Password"
          intro={
            <>
              Choose a new password for <span className="break-all">{email}</span>.
            </>
          }
        />
        {form}
      </div>
    )
  }
  return (
    <PhoneBar
      title="Reset password"
      backLabel="Back to sign in"
      onBack={onBack}
      bubble="Choose a new password."
    >
      {form}
    </PhoneBar>
  )
}

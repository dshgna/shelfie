// Forgot password: email and "Send reset link". What comes next never says whether the address has
// an account (CheckEmail), so the form can't be used to find out who uses Shelfie.

import { useRef, useState, type FormEvent } from 'react'
import { Button, Form } from 'react-aria-components'
import { toAuthErrorCode } from '../../auth/errors'
import { useAuth } from '../../auth/useAuth'
import { CardTitle, FormProblem, PhoneBar, useFocusOnMount } from './AuthLayout'
import { EmailField } from './fields'
import { PRIMARY, TEXT_LINK } from './styles'
import { useAuthSubmit } from './useAuthSubmit'
import { emailError } from './validation'

export interface ForgotPasswordProps {
  wide: boolean
  autoFocus: boolean
  email: string
  onEmailChange: (email: string) => void
  onBack: () => void
  onSent: () => void
  /** Shown above the form, e.g. when a reset link has expired. */
  notice?: string | undefined
}

export function ForgotPassword({
  wide,
  autoFocus,
  email,
  onEmailChange,
  onBack,
  onSent,
  notice,
}: ForgotPasswordProps) {
  const { requestPasswordReset } = useAuth()
  const [error, setError] = useState<string | undefined>()
  const submit = useAuthSubmit()
  const emailRef = useRef<HTMLInputElement>(null)
  useFocusOnMount(emailRef, autoFocus)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = emailError(email)
    setError(found)
    if (found) {
      submit.fail(found)
      return
    }
    void submit
      .run(async () => {
        try {
          await requestPasswordReset(email.trim())
        } catch (error) {
          // Only problems the person can act on are shown; anything else still goes to the same
          // "If that address has an account" screen.
          const code = toAuthErrorCode(error)
          if (code === 'network' || code === 'rateLimited') throw error
        }
      })
      .then((sent) => {
        if (sent) onSent()
      })
  }

  const form = (
    <Form onSubmit={onSubmit} validationBehavior="aria" className="flex flex-col gap-4">
      {notice && <p className="m-0 text-[15px] font-semibold text-ink">{notice}</p>}
      <FormProblem message={submit.problem} problemRef={submit.problemRef} />
      <EmailField
        value={email}
        onChange={(value) => {
          onEmailChange(value)
          if (error) setError(emailError(value))
        }}
        onBlur={() => {
          if (email !== '') setError(emailError(email))
        }}
        error={error}
        autoComplete="email"
        inputRef={emailRef}
      />
      <Button type="submit" isDisabled={submit.pending} className={PRIMARY}>
        Send reset link
      </Button>
      <div className="text-center">
        <Button onPress={onBack} className={TEXT_LINK}>
          Back to sign in
        </Button>
      </div>
    </Form>
  )

  if (wide) {
    return (
      <div className="flex flex-col gap-[18px]">
        <CardTitle
          title="Forgot Your Password?"
          intro="Enter your email and we'll send you a link to reset it."
        />
        {form}
      </div>
    )
  }
  return (
    <PhoneBar
      title="Forgot password"
      backLabel="Back to sign in"
      onBack={onBack}
      bubble="It happens! Tell me your email and I'll send you a link to reset your password."
    >
      {form}
    </PhoneBar>
  )
}

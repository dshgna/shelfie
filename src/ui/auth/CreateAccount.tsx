// Create account: email, a new password (eye button, Generate password, Copy) and "Create account".
// Phone: the first screen when signed out (PhoneHero). Web: the "Create account" tab of the card.

import { useRef, useState, type FormEvent } from 'react'
import { Button, Form } from 'react-aria-components'
import { generatePassword } from '../../auth/password'
import { useAuth } from '../../auth/useAuth'
import { CardTitle, FormProblem, LockIcon, PhoneHero, useFocusOnMount } from './AuthLayout'
import { EmailField } from './fields'
import { PasswordField } from './PasswordField'
import { PasswordTools } from './PasswordTools'
import { INLINE_LINK, PRIMARY } from './styles'
import { useAuthSubmit } from './useAuthSubmit'
import { emailError, newPasswordError, summaryOf } from './validation'

export interface CreateAccountProps {
  wide: boolean
  autoFocus: boolean
  email: string
  onEmailChange: (email: string) => void
  onSignIn: () => void
  /** Supabase sent a confirmation email: show Check your email. */
  onCheckEmail: () => void
  writeClipboard?: (text: string) => Promise<void>
  generate?: () => string
}

/** Opens on the landing page site (same origin), in a new tab. */
function NewTabLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={INLINE_LINK}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

export function CreateAccount({
  wide,
  autoFocus,
  email,
  onEmailChange,
  onSignIn,
  onCheckEmail,
  writeClipboard,
  generate = generatePassword,
}: CreateAccountProps) {
  const { signUp } = useAuth()
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [errors, setErrors] = useState<{
    email?: string | undefined
    password?: string | undefined
  }>({})
  const submit = useAuthSubmit()
  const emailRef = useRef<HTMLInputElement>(null)
  useFocusOnMount(emailRef, autoFocus)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = { email: emailError(email), password: newPasswordError(password) }
    setErrors(found)
    const summary = summaryOf([found.email, found.password])
    if (summary) {
      submit.fail(summary)
      return
    }
    void submit.run(async () => {
      const { needsConfirmation } = await signUp(email.trim(), password)
      if (needsConfirmation) onCheckEmail()
    })
  }

  const form = (
    <Form onSubmit={onSubmit} validationBehavior="aria" className="flex flex-col gap-4">
      <FormProblem message={submit.problem} problemRef={submit.problemRef} />
      <EmailField
        value={email}
        onChange={(value) => {
          onEmailChange(value)
          if (errors.email) setErrors((e) => ({ ...e, email: emailError(value) }))
        }}
        onBlur={() => {
          if (email !== '') setErrors((e) => ({ ...e, email: emailError(email) }))
        }}
        error={errors.email}
        autoComplete="username"
        inputRef={emailRef}
      />
      <div className="flex flex-col gap-0.5">
        <PasswordField
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            if (errors.password) setErrors((e) => ({ ...e, password: newPasswordError(value) }))
          }}
          onBlur={() => {
            if (password !== '') setErrors((e) => ({ ...e, password: newPasswordError(password) }))
          }}
          autoComplete="new-password"
          revealed={revealed}
          onRevealedChange={setRevealed}
          error={errors.password}
        />
        <PasswordTools
          value={password}
          writeClipboard={writeClipboard}
          onGenerate={() => {
            const next = generate()
            setPassword(next)
            setRevealed(true)
            setErrors((e) => ({ ...e, password: undefined }))
          }}
        />
      </div>
      {wide && (
        <p className="m-0 flex gap-2 text-[13px] text-muted">
          <span className="text-accent">
            <LockIcon size={16} />
          </span>
          Your shelves are encrypted on your device before they sync. Shelfie can't read them.
        </p>
      )}
      <Button type="submit" isDisabled={submit.pending} className={PRIMARY}>
        Create account
      </Button>
      <p className="m-0 text-center text-[13px] text-muted">
        By creating an account you agree to the <NewTabLink href="/terms">Terms</NewTabLink> and{' '}
        <NewTabLink href="/privacy">Privacy notice</NewTabLink>.
      </p>
    </Form>
  )

  if (wide) {
    return (
      <div className="flex flex-col gap-[18px]">
        <CardTitle title="Create Your Account" />
        {form}
      </div>
    )
  }
  return (
    <PhoneHero heading="Create your account">
      {form}
      <p className="m-0 mt-auto text-center text-[15px] text-muted">
        Already have an account?{' '}
        <Button onPress={onSignIn} className={`${INLINE_LINK} min-h-[44px]`}>
          Sign in
        </Button>
      </p>
    </PhoneHero>
  )
}

// Sign in: email, password (eye button), "Forgot password?", "Keep me signed in" and "Sign in".
// A wrong password and an unknown email always show the same message (errors.ts).

import { useRef, useState, type FormEvent } from 'react'
import { Button, Form } from 'react-aria-components'
import { useAuth } from '../../auth/useAuth'
import { CardTitle, FormProblem, PhoneBar, useFocusOnMount } from './AuthLayout'
import { EmailField, KeepSignedIn } from './fields'
import { PasswordField } from './PasswordField'
import { INLINE_LINK, PRIMARY, TEXT_LINK } from './styles'
import { useAuthSubmit } from './useAuthSubmit'
import { currentPasswordError, emailError, summaryOf } from './validation'

/** The checkbox label: "phone" in the iOS and Android apps (Capacitor), "device" on the web. */
export function keepSignedInLabel(nativeApp: boolean): string {
  return nativeApp ? 'Keep me signed in on this phone' : 'Keep me signed in on this device'
}

const isNativeApp = () => typeof window !== 'undefined' && 'Capacitor' in window

export interface SignInProps {
  wide: boolean
  autoFocus: boolean
  email: string
  onEmailChange: (email: string) => void
  onCreateAccount: () => void
  onForgotPassword: () => void
}

export function SignIn({
  wide,
  autoFocus,
  email,
  onEmailChange,
  onCreateAccount,
  onForgotPassword,
}: SignInProps) {
  const { signIn } = useAuth()
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [keep, setKeep] = useState(true)
  const [errors, setErrors] = useState<{
    email?: string | undefined
    password?: string | undefined
  }>({})
  const submit = useAuthSubmit()
  const emailRef = useRef<HTMLInputElement>(null)
  useFocusOnMount(emailRef, autoFocus)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = { email: emailError(email), password: currentPasswordError(password) }
    setErrors(found)
    const summary = summaryOf([found.email, found.password])
    if (summary) {
      submit.fail(summary)
      return
    }
    void submit.run(async () => {
      await signIn(email.trim(), password, keep)
    })
  }

  const forgot = (
    <Button onPress={onForgotPassword} className={TEXT_LINK}>
      Forgot password?
    </Button>
  )
  const keepBox = (
    <KeepSignedIn isSelected={keep} onChange={setKeep} label={keepSignedInLabel(isNativeApp())} />
  )

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
      <PasswordField
        label="Password"
        value={password}
        onChange={(value) => {
          setPassword(value)
          if (errors.password) setErrors((e) => ({ ...e, password: currentPasswordError(value) }))
        }}
        autoComplete="current-password"
        revealed={revealed}
        onRevealedChange={setRevealed}
        error={errors.password}
      />
      {wide ? (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {keepBox}
          {forgot}
        </div>
      ) : (
        <>
          <div className="-mt-2">{forgot}</div>
          <div className="px-2.5">{keepBox}</div>
        </>
      )}
      <Button type="submit" isDisabled={submit.pending} className={PRIMARY}>
        Sign in
      </Button>
      <p className="m-0 text-center text-sm text-muted">
        New to Shelfie?{' '}
        <Button onPress={onCreateAccount} className={`${INLINE_LINK} min-h-[44px]`}>
          Create an account
        </Button>
      </p>
    </Form>
  )

  if (wide) {
    return (
      <div className="flex flex-col gap-[18px]">
        <CardTitle title="Welcome Back" />
        {form}
      </div>
    )
  }
  return (
    <PhoneBar
      title="Sign in"
      backLabel="Back to create account"
      onBack={onCreateAccount}
      bubble="Welcome back! Your shelves are waiting."
    >
      {form}
    </PhoneBar>
  )
}

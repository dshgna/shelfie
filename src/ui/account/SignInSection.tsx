// Account settings, Sign-in section: the email (Change: a new address, confirmed by email) and the
// password (Change: a new password with the eye button, Generate password and Copy). If Supabase
// wants a recent sign-in first, the form asks for the password, signs in again, then retries.
// Passwords live only in this component's state while the form is open.

import { useRef, useState, type FormEvent } from 'react'
import { Button, FieldError, Form, Input, Label, TextField } from 'react-aria-components'
import { generatePassword } from '../../auth/password'
import { useAuth } from '../../auth/useAuth'
import { FormProblem, useFocusOnMount } from '../auth/AuthLayout'
import { PasswordField } from '../auth/PasswordField'
import { PasswordTools } from '../auth/PasswordTools'
import { AUTH_INPUT, FIELD_ERROR, LABEL, SECONDARY } from '../auth/styles'
import { useAuthSubmit } from '../auth/useAuthSubmit'
import { currentPasswordError, emailError, newPasswordError } from '../auth/validation'
import { ACCENT_BUTTON, Row, Section, UserIcon } from './parts'

type Change = 'email' | 'password'

/** "Please sign in again": the current password, then the change is tried again. */
function SignInAgain({ onSignedIn, onCancel }: { onSignedIn: () => void; onCancel: () => void }) {
  const { confirmPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const submit = useAuthSubmit()
  const ref = useRef<HTMLInputElement>(null)
  useFocusOnMount(ref, true)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = currentPasswordError(password)
    setError(found)
    if (found) return submit.fail(found)
    void submit
      .run(() => confirmPassword(password))
      .then((ok) => {
        if (ok) onSignedIn()
      })
  }

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria" className="flex flex-col gap-3 pb-2">
      <p className="m-0 text-[15px] font-semibold text-ink">Please sign in again to change this.</p>
      <FormProblem message={submit.problem} problemRef={submit.problemRef} />
      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        revealed={revealed}
        onRevealedChange={setRevealed}
        error={error}
        inputRef={ref}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isDisabled={submit.pending} className={ACCENT_BUTTON}>
          Sign in
        </Button>
        <Button onPress={onCancel} className={SECONDARY}>
          Cancel
        </Button>
      </div>
    </Form>
  )
}

function ChangeEmail({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { updateEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [again, setAgain] = useState(false)
  const submit = useAuthSubmit()
  const ref = useRef<HTMLInputElement>(null)
  useFocusOnMount(ref, true)

  const save = () =>
    void submit
      .run(
        () => updateEmail(email.trim()),
        (code) => {
          if (code === 'signInAgain') setAgain(true)
          return undefined
        },
      )
      .then((ok) => {
        if (ok) onDone()
      })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = emailError(email)
    setError(found)
    if (found) return submit.fail(found)
    save()
  }

  if (again) {
    return (
      <SignInAgain
        onSignedIn={() => {
          setAgain(false)
          save()
        }}
        onCancel={onCancel}
      />
    )
  }
  return (
    <Form onSubmit={onSubmit} validationBehavior="aria" className="flex flex-col gap-3 pb-2">
      <FormProblem message={submit.problem} problemRef={submit.problemRef} />
      <TextField
        value={email}
        onChange={(value) => {
          setEmail(value)
          if (error) setError(emailError(value))
        }}
        type="email"
        isInvalid={error !== undefined}
        validationBehavior="aria"
        className="flex flex-col gap-1.5"
      >
        <Label className={LABEL}>New email</Label>
        <Input
          ref={ref}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          className={AUTH_INPUT}
        />
        <FieldError className={FIELD_ERROR}>{error}</FieldError>
      </TextField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isDisabled={submit.pending} className={ACCENT_BUTTON}>
          Save email
        </Button>
        <Button onPress={onCancel} className={SECONDARY}>
          Cancel
        </Button>
      </div>
    </Form>
  )
}

function ChangePassword({
  onDone,
  onCancel,
  writeClipboard,
  generate = generatePassword,
}: {
  onDone: () => void
  onCancel: () => void
  writeClipboard?: ((text: string) => Promise<void>) | undefined
  generate?: (() => string) | undefined
}) {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [again, setAgain] = useState(false)
  const submit = useAuthSubmit()
  const ref = useRef<HTMLInputElement>(null)
  useFocusOnMount(ref, true)

  const save = () =>
    void submit
      .run(
        () => updatePassword(password),
        (code) => {
          if (code === 'signInAgain') setAgain(true)
          return undefined
        },
      )
      .then((ok) => {
        if (ok) onDone()
      })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = newPasswordError(password)
    setError(found)
    if (found) return submit.fail(found)
    save()
  }

  if (again) {
    return (
      <SignInAgain
        onSignedIn={() => {
          setAgain(false)
          save()
        }}
        onCancel={onCancel}
      />
    )
  }
  return (
    <Form onSubmit={onSubmit} validationBehavior="aria" className="flex flex-col gap-3 pb-2">
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
          inputRef={ref}
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isDisabled={submit.pending} className={ACCENT_BUTTON}>
          Save password
        </Button>
        <Button onPress={onCancel} className={SECONDARY}>
          Cancel
        </Button>
      </div>
    </Form>
  )
}

export function SignInSection({
  title,
  email,
  writeClipboard,
  generate,
}: {
  title: string
  email: string
  writeClipboard?: (text: string) => Promise<void>
  generate?: () => string
}) {
  const [open, setOpen] = useState<Change | null>(null)
  const [done, setDone] = useState<Change | null>(null)
  const start = (change: Change) => {
    setDone(null)
    setOpen(change)
  }

  return (
    <Section title={title} icon={<UserIcon />}>
      <Row
        title="Email"
        detail={<span className="break-all">{email}</span>}
        action={
          open !== 'email' && (
            <Button aria-label="Change email" onPress={() => start('email')} className={SECONDARY}>
              Change
            </Button>
          )
        }
      >
        {open === 'email' && (
          <ChangeEmail
            onDone={() => {
              setOpen(null)
              setDone('email')
            }}
            onCancel={() => setOpen(null)}
          />
        )}
      </Row>
      <Row
        title="Password"
        action={
          open !== 'password' && (
            <Button
              aria-label="Change password"
              onPress={() => start('password')}
              className={SECONDARY}
            >
              Change
            </Button>
          )
        }
      >
        {open === 'password' && (
          <ChangePassword
            onDone={() => {
              setOpen(null)
              setDone('password')
            }}
            onCancel={() => setOpen(null)}
            writeClipboard={writeClipboard}
            generate={generate}
          />
        )}
      </Row>
      <p role="status" className="m-0 text-sm font-semibold text-sprout-deep">
        {done === 'email' && 'Check your new address to confirm.'}
        {done === 'password' && 'Password changed.'}
      </p>
    </Section>
  )
}

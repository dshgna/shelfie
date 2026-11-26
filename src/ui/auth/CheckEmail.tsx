// Check your email: after creating an account (when Supabase asks for email confirmation) and
// after "Send reset link". Shows the address, "Resend email" (once per 60 seconds, with a visible
// countdown) and "Use a different email". The reset wording never says whether the address has an
// account.

import { useEffect, useRef, useState } from 'react'
import { Button } from 'react-aria-components'
import { useAuth } from '../../auth/useAuth'
import { CardTitle, FormProblem, PhoneBar, useFocusOnMount } from './AuthLayout'
import { SECONDARY, TEXT_LINK } from './styles'
import { useAuthSubmit } from './useAuthSubmit'

export const RESEND_AFTER_SECONDS = 60

/** Counts down once a second from `seconds` to 0; `restart` starts again. */
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])
  return { left, restart: () => setLeft(seconds) }
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="34"
      height="34"
      aria-hidden="true"
      className="fill-none stroke-current [stroke-width:1.8] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </svg>
  )
}

export interface CheckEmailProps {
  kind: 'signup' | 'reset'
  wide: boolean
  autoFocus: boolean
  email: string
  onBack: () => void
  onDifferentEmail: () => void
}

export function CheckEmail({
  kind,
  wide,
  autoFocus,
  email,
  onBack,
  onDifferentEmail,
}: CheckEmailProps) {
  const { resendConfirmation, requestPasswordReset } = useAuth()
  const countdown = useCountdown(RESEND_AFTER_SECONDS)
  const [sentAgain, setSentAgain] = useState(false)
  const submit = useAuthSubmit()
  const headingRef = useRef<HTMLHeadingElement>(null)
  useFocusOnMount(headingRef, autoFocus)

  const resend = () => {
    setSentAgain(false)
    void submit
      .run(() => (kind === 'signup' ? resendConfirmation(email) : requestPasswordReset(email)))
      .then((ok) => {
        if (ok) {
          setSentAgain(true)
          countdown.restart()
        }
      })
  }

  const waiting = countdown.left > 0

  const body = (
    <>
      <div className="flex justify-center">
        <span className="grid size-[72px] place-items-center rounded-[20px] bg-eu-20 text-sprout-deep">
          <MailIcon />
        </span>
      </div>
      <p className="m-0 text-center text-base text-ink">
        {kind === 'signup' ? (
          <>
            We sent a link to <b className="break-all">{email}</b>. Open it to finish creating your
            account.
          </>
        ) : (
          <>If that address has an account, we have sent a link.</>
        )}
      </p>
      <FormProblem message={submit.problem} problemRef={submit.problemRef} />
      <p className="m-0 text-center text-sm text-muted">Nothing yet? Check your spam folder.</p>
      <div className="flex flex-col items-center gap-1.5">
        <Button
          onPress={resend}
          isDisabled={waiting || submit.pending}
          className={SECONDARY}
          aria-describedby="resend-wait"
        >
          Resend email
        </Button>
        <p id="resend-wait" className="m-0 min-h-5 text-sm text-muted">
          {waiting ? `You can send it again in ${countdown.left} s.` : ''}
        </p>
        <p role="status" className="m-0 min-h-5 text-sm font-semibold text-sprout-deep">
          {sentAgain ? 'Sent again.' : ''}
        </p>
      </div>
      <div className="text-center">
        <Button onPress={onDifferentEmail} className={TEXT_LINK}>
          Use a different email
        </Button>
      </div>
    </>
  )

  if (wide) {
    return (
      <div className="flex flex-col gap-[18px]">
        <CardTitle title="Check Your Email" headingRef={headingRef} />
        {body}
      </div>
    )
  }
  return (
    <PhoneBar
      title="Check your email"
      backLabel="Back"
      onBack={onBack}
      bubble="Link on its way!"
      headingRef={headingRef}
    >
      {body}
    </PhoneBar>
  )
}

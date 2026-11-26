// Account settings, from prototype-create-account-sign-in.html ("Account settings", web and phone).
// Sections in order: Sign-in, Privacy, Devices, Your data; then Sign out on the phone layout (on
// the web it is in the header's account menu). Web: Sign-in and Privacy in the left column, Devices
// and Your data in the right. Nothing here lists other devices: the Supabase client can't list
// sessions (see docs/decisions.md, Open questions).

import { useRef, useState } from 'react'
import { Button, Input, Label, TextField } from 'react-aria-components'
import { useAuth } from '../../auth/useAuth'
import { LogoJar } from '../Header'
import { Leaves } from '../Leaves'
import { PlanLabel } from '../PlanLabel'
import { useFocusOnMount, useWide } from '../auth/AuthLayout'
import { AUTH_INPUT, FOCUS, LABEL, SECONDARY } from '../auth/styles'
import { messageFor } from '../auth/useAuthSubmit'
import { deviceName } from './device-name'
import {
  ACCENT_BUTTON,
  ChevronIcon,
  ConfirmDialog,
  DANGER_OUTLINE,
  DataIcon,
  DevicesIcon,
  Row,
  Section,
  ShieldIcon,
} from './parts'
import { SignInSection } from './SignInSection'

function PrivacySection({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
  return (
    <Section title="Privacy" icon={<ShieldIcon />}>
      <div className="border-t border-ink/15">
        <Button
          onPress={onOpenPrivacy}
          className={`-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 text-left text-[15px] font-semibold text-ink data-hovered:bg-surface-2 ${FOCUS}`}
        >
          <span className="flex-1">Analytics and privacy</span>
          <ChevronIcon />
        </Button>
      </div>
    </Section>
  )
}

function DevicesSection({ userAgent, wide }: { userAgent: string; wide: boolean }) {
  const { signOutOthers } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState('')

  const signOutElsewhere = async (close: () => void) => {
    if (pending) return
    setPending(true)
    try {
      await signOutOthers()
      setResult('Signed out of other devices')
    } catch (error) {
      setResult(messageFor(error))
    } finally {
      setPending(false)
      close()
    }
  }

  return (
    <Section title="Devices" icon={<DevicesIcon />}>
      <Row
        title={deviceName(userAgent)}
        detail={`${wide ? 'This device' : 'This phone'} · Signed in now`}
      />
      <Row
        title="Other devices"
        detail="Sign out everywhere else. You stay signed in here."
        action={
          <Button
            onPress={() => {
              setResult('')
              setConfirming(true)
            }}
            className={SECONDARY}
          >
            Sign out other devices
          </Button>
        }
      />
      <p role="status" className="m-0 text-sm font-semibold text-sprout-deep">
        {result}
      </p>
      <ConfirmDialog
        title="Sign out other devices?"
        isOpen={confirming}
        onOpenChange={setConfirming}
      >
        {(close) => (
          <>
            <p className="m-0 text-muted">
              Every other phone and browser will need to sign in again. This one stays signed in.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button autoFocus onPress={close} className={SECONDARY}>
                Cancel
              </Button>
              <Button
                onPress={() => void signOutElsewhere(close)}
                isDisabled={pending}
                className={ACCENT_BUTTON}
              >
                Sign out other devices
              </Button>
            </div>
          </>
        )}
      </ConfirmDialog>
    </Section>
  )
}

function DataSection({ title, wide }: { title: string; wide: boolean }) {
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  const here = wide ? 'This device' : 'This phone'

  return (
    <Section title={title} icon={<DataIcon />}>
      <Row
        title="Export my data"
        detail="Download everything as a file (JSON or CSV)."
        action={<PlanLabel now={false} />}
      />
      <Row
        title="Delete my account"
        detail={
          <>
            Deletes your account and synced shelves. {here} keeps its copy until you clear it.
            Deleting your account will be available before launch.
          </>
        }
        action={
          <Button
            onPress={() => {
              setTyped('')
              setDeleting(true)
            }}
            className={DANGER_OUTLINE}
          >
            Delete account
          </Button>
        }
      />
      <ConfirmDialog title="Delete your account?" isOpen={deleting} onOpenChange={setDeleting}>
        {(close) => (
          <>
            <p className="m-0 text-muted">
              This deletes your account and synced shelves. {here} keeps its copy until you clear
              it.
            </p>
            <TextField value={typed} onChange={setTyped} className="flex flex-col gap-1.5">
              <Label className={LABEL}>Type your email to confirm</Label>
              <Input
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className={AUTH_INPUT}
              />
            </TextField>
            <p className="m-0 flex items-center gap-2 text-sm text-muted">
              <PlanLabel now={false} />
              Deleting your account will be available before launch.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button autoFocus onPress={close} className={SECONDARY}>
                Cancel
              </Button>
              {/* Stays off until account deletion exists (it needs a server function). */}
              <Button isDisabled className={DANGER_OUTLINE}>
                Delete account
              </Button>
            </div>
          </>
        )}
      </ConfirmDialog>
    </Section>
  )
}

export interface AccountSettingsProps {
  onClose: () => void
  onOpenPrivacy: () => void
  /** For tests; the app reads navigator.userAgent. */
  userAgent?: string
  writeClipboard?: (text: string) => Promise<void>
  generate?: () => string
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      className="fill-none stroke-current [stroke-width:2] [stroke-linecap:round]"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      className="fill-none stroke-current [stroke-width:2] [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

const SQUARE_BUTTON = `grid size-[44px] flex-none place-items-center rounded-xl border border-edge bg-surface text-ink data-hovered:bg-surface-2 ${FOCUS}`

export function AccountSettings({
  onClose,
  onOpenPrivacy,
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  writeClipboard,
  generate,
}: AccountSettingsProps) {
  const { user, signOut } = useAuth()
  const wide = useWide()
  const headingRef = useRef<HTMLHeadingElement>(null)
  useFocusOnMount(headingRef, true)
  const [signOutProblem, setSignOutProblem] = useState('')
  const email = user?.email ?? ''

  const signIn = (
    <SignInSection
      title={wide ? 'Sign-In' : 'Sign-in'}
      email={email}
      writeClipboard={writeClipboard}
      generate={generate}
    />
  )
  const privacy = <PrivacySection onOpenPrivacy={onOpenPrivacy} />
  const devices = <DevicesSection userAgent={userAgent} wide={wide} />
  const data = <DataSection title={wide ? 'Your Data' : 'Your data'} wide={wide} />

  if (wide) {
    return (
      <div className="relative min-h-dvh px-6 pt-6 pb-10">
        <Leaves />
        <div className="mx-auto flex max-w-[70rem] flex-col gap-[18px]">
          <header className="flex flex-wrap items-center gap-3.5">
            <div className="flex items-center gap-2.5">
              <LogoJar className="size-10" />
              <span className="font-display text-[26px] leading-none font-semibold">Shelfie</span>
            </div>
            <span aria-hidden="true" className="text-muted">
              /
            </span>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="m-0 mr-auto font-display text-[26px] leading-none font-semibold outline-none"
            >
              Account
            </h1>
            <Button aria-label="Close" onPress={onClose} className={SQUARE_BUTTON}>
              <CloseIcon />
            </Button>
          </header>
          <main className="grid grid-cols-2 items-start gap-4">
            <div className="flex flex-col gap-4">
              {signIn}
              {privacy}
            </div>
            <div className="flex flex-col gap-4">
              {devices}
              {data}
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col">
      <Leaves />
      <header className="flex flex-none items-center gap-2.5 px-4 pt-3.5 pb-2">
        <Button aria-label="Back to shelves" onPress={onClose} className={SQUARE_BUTTON}>
          <BackIcon />
        </Button>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="m-0 flex-1 font-display text-[22px] leading-tight font-semibold outline-none"
        >
          Account
        </h1>
      </header>
      <main className="flex flex-1 flex-col gap-3.5 px-4 pt-1.5 pb-7">
        {signIn}
        {privacy}
        {devices}
        {data}
        <Button
          onPress={() => {
            setSignOutProblem('')
            signOut().catch((error: unknown) => setSignOutProblem(messageFor(error)))
          }}
          className={`${SECONDARY} h-[52px] w-full`}
        >
          Sign out
        </Button>
        <p aria-live="polite" className="m-0 text-sm font-semibold text-danger">
          {signOutProblem}
        </p>
      </main>
    </div>
  )
}

/** Placeholder until the analytics switches exist (docs/decisions.md, TODO). */
export function PrivacySettings({ onBack }: { onBack: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useFocusOnMount(headingRef, true)
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[70rem] flex-col">
      <Leaves />
      <main className="flex flex-none items-center gap-2.5 px-4 pt-3.5 pb-2 md:px-6 md:pt-6">
        <Button aria-label="Back to Account" onPress={onBack} className={SQUARE_BUTTON}>
          <BackIcon />
        </Button>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="m-0 flex-1 font-display text-[22px] leading-tight font-semibold outline-none md:text-[26px]"
        >
          Analytics and privacy
        </h1>
      </main>
    </div>
  )
}

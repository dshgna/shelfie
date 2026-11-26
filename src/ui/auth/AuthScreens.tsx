// The signed-out screens and which one is showing. The email typed on one screen carries to the
// next in memory only: never in the URL or storage. On the web layout, Create account and Sign in
// are two tabs of one card; elsewhere links switch screens. Focus moves to the new screen's first
// field (or heading) when the screen changes, but not when a tab is chosen with the keyboard.

import { useState } from 'react'
import { Tab, TabList, TabPanel, Tabs, type Key } from 'react-aria-components'
import { AuthLayout, useWide } from './AuthLayout'
import { CheckEmail } from './CheckEmail'
import { CreateAccount } from './CreateAccount'
import { ForgotPassword } from './ForgotPassword'
import { ResetPassword } from './ResetPassword'
import { SignIn } from './SignIn'
import { FOCUS } from './styles'

export type AuthView = 'create' | 'signIn' | 'forgot' | 'checkSignup' | 'checkReset' | 'reset'

export interface AuthScreensProps {
  initialView?: AuthView
  /** A line above the Forgot password form (e.g. an expired reset link). */
  notice?: string | undefined
  /** The signed-in account's email, for Reset password. */
  accountEmail?: string
  /** Reset password saved, or left: open the app. */
  onResetDone?: () => void
  /** Reset password's back button. */
  onResetBack?: () => void
  writeClipboard?: (text: string) => Promise<void>
  generate?: () => string
}

const TAB =
  'flex min-h-[44px] flex-1 cursor-default items-center justify-center rounded-[10px] px-2.5 text-[15px] leading-none'

export function AuthScreens({
  initialView = 'create',
  notice,
  accountEmail = '',
  onResetDone = () => {},
  onResetBack = () => {},
  writeClipboard,
  generate,
}: AuthScreensProps) {
  const wide = useWide()
  const [screen, setScreen] = useState<{ view: AuthView; focus: boolean }>({
    view: initialView,
    focus: false,
  })
  const [email, setEmail] = useState('')
  const go = (view: AuthView) => setScreen({ view, focus: true })
  const { view, focus } = screen

  const create = (
    <CreateAccount
      wide={wide}
      autoFocus={focus}
      email={email}
      onEmailChange={setEmail}
      onSignIn={() => go('signIn')}
      onCheckEmail={() => go('checkSignup')}
      writeClipboard={writeClipboard}
      generate={generate}
    />
  )
  const signIn = (
    <SignIn
      wide={wide}
      autoFocus={focus}
      email={email}
      onEmailChange={setEmail}
      onCreateAccount={() => go('create')}
      onForgotPassword={() => go('forgot')}
    />
  )

  let content
  if ((view === 'create' || view === 'signIn') && wide) {
    content = (
      <Tabs
        selectedKey={view}
        onSelectionChange={(key: Key) => setScreen({ view: key as AuthView, focus: false })}
        className="flex flex-col gap-[18px]"
      >
        <TabList aria-label="Account" className="flex gap-0.5 rounded-[13px] bg-ink/6 p-[3px]">
          {(
            [
              ['create', 'Create account'],
              ['signIn', 'Sign in'],
            ] as const
          ).map(([id, label]) => (
            <Tab
              key={id}
              id={id}
              className={({ isSelected }) =>
                `${TAB} ${FOCUS} ${isSelected ? 'bg-surface font-bold text-ink shadow-sm shadow-ink/20' : 'font-medium text-muted'}`
              }
            >
              {label}
            </Tab>
          ))}
        </TabList>
        <TabPanel id="create">{create}</TabPanel>
        <TabPanel id="signIn">{signIn}</TabPanel>
      </Tabs>
    )
  } else if (view === 'create') {
    content = create
  } else if (view === 'signIn') {
    content = signIn
  } else if (view === 'forgot') {
    content = (
      <ForgotPassword
        wide={wide}
        autoFocus={focus}
        email={email}
        onEmailChange={setEmail}
        onBack={() => go('signIn')}
        onSent={() => go('checkReset')}
        notice={notice}
      />
    )
  } else if (view === 'checkSignup' || view === 'checkReset') {
    content = (
      <CheckEmail
        key={view}
        kind={view === 'checkSignup' ? 'signup' : 'reset'}
        wide={wide}
        autoFocus={focus}
        email={email}
        onBack={() => go(view === 'checkSignup' ? 'create' : 'signIn')}
        onDifferentEmail={() => {
          setEmail('')
          go(view === 'checkSignup' ? 'create' : 'forgot')
        }}
      />
    )
  } else {
    content = (
      <ResetPassword
        wide={wide}
        autoFocus={focus}
        email={accountEmail}
        onBack={onResetBack}
        onDone={onResetDone}
        writeClipboard={writeClipboard}
        generate={generate}
      />
    )
  }

  return <AuthLayout wide={wide}>{content}</AuthLayout>
}

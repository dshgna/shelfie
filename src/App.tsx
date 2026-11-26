import { useEffect, useState } from 'react'
import { RESET_PASSWORD_PATH } from './auth/service'
import { useAuth } from './auth/useAuth'
import { startOfToday } from './domain/dates'
import { openUserProfile } from './storage/firstRun'
import { createMemoryItemRepository } from './storage/memory-repository'
import { AccountSettings, PrivacySettings } from './ui/account/AccountSettings'
import { ACCOUNT_MENU_ID } from './ui/account/AccountMenu'
import { AppShell } from './ui/AppShell'
import { AuthScreens, type AuthView } from './ui/auth/AuthScreens'
import { SEED_HOUSEHOLD_ID, seedItems } from './ui/seed'

const RESET_PATH = `${import.meta.env.BASE_URL}${RESET_PASSWORD_PATH}`

/** The reset email's link opens /app/reset-password/ (with or without the trailing slash). */
function onResetPath(): boolean {
  const path = window.location.pathname
  return path === RESET_PATH || path === RESET_PATH.replace(/\/$/, '')
}

/** Supabase puts an error in the URL hash when a reset link has expired or was already used. */
function resetLinkFailed(): boolean {
  return /(^|[#&])error(_code)?=/.test(window.location.hash)
}

/** Leaves the reset address (and its hash) for the app's own address, without a reload. */
function leaveResetPath() {
  window.history.replaceState(null, '', import.meta.env.BASE_URL)
}

/**
 * An account is required (no guest mode). Signed out, every address under /app/ shows the sign-in
 * screens; signed in, they never show, except Reset password when the reset link was opened.
 */
export default function App() {
  const { status, user, signOut } = useAuth()
  const [resetting, setResetting] = useState(onResetPath)
  // After signing out in this visit, open on Sign in rather than Create account.
  const [hasSignedIn, setHasSignedIn] = useState(false)
  useEffect(() => {
    if (status === 'signedIn') setHasSignedIn(true)
  }, [status])

  if (status === 'loading') return <Loading />

  if (status === 'signedIn' && user) {
    if (resetting) {
      return (
        <AuthScreens
          initialView="reset"
          accountEmail={user.email}
          onResetDone={() => {
            leaveResetPath()
            setResetting(false)
          }}
          onResetBack={() => {
            leaveResetPath()
            setResetting(false)
            void signOut()
          }}
        />
      )
    }
    // Keyed by account, so a different account starts from a fresh state.
    return <SignedInApp key={user.id} userId={user.id} />
  }

  let initialView: AuthView = hasSignedIn ? 'signIn' : 'create'
  let notice: string | undefined
  if (resetting) {
    initialView = 'forgot'
    if (resetLinkFailed()) notice = 'That link has expired or was already used. Send a new one.'
  }
  return <AuthScreens key={initialView} initialView={initialView} notice={notice} />
}

function Loading() {
  return (
    <p role="status" className="p-4">
      Loading
    </p>
  )
}

/**
 * Opens the account's own database and makes sure it has a local profile, then shows the shelves.
 * The database is closed (not deleted) on sign-out, so the data stays on the device.
 *
 * The shelves still use the in-memory repository with invented example items until the app is
 * wired to the Dexie repository. One repository is created and shared, as repository.ts asks.
 */
function SignedInApp({ userId }: { userId: string }) {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<'shelves' | 'account' | 'privacy'>('shelves')
  const [failure, setFailure] = useState<unknown>(null)
  const [repository] = useState(() =>
    createMemoryItemRepository({ now: () => new Date().toISOString() }),
  )

  useEffect(() => {
    let closed = false
    let close = () => {}
    openUserProfile(userId, { now: () => new Date(), newId: () => crypto.randomUUID() }).then(
      ({ db }) => {
        if (closed) {
          db.close()
          return
        }
        close = () => db.close()
        setReady(true)
      },
      (error: unknown) => {
        if (!closed) setFailure(error)
      },
    )
    return () => {
      closed = true
      close()
    }
  }, [userId])

  useEffect(() => {
    const today = startOfToday(new Date())
    for (const item of seedItems(today)) void repository.put(item)
  }, [repository])

  if (failure) throw failure
  if (!ready) return <Loading />
  return (
    <>
      {/* The shelves stay mounted (hidden) while Account settings is open, so nothing is lost. */}
      <div hidden={screen !== 'shelves'}>
        <AppShell
          repository={repository}
          householdId={SEED_HOUSEHOLD_ID}
          onOpenAccount={() => setScreen('account')}
        />
      </div>
      {screen === 'account' && (
        <AccountSettings
          onClose={() => {
            setScreen('shelves')
            // Back to the menu button that opened Account settings, once it is shown again.
            requestAnimationFrame(() => document.getElementById(ACCOUNT_MENU_ID)?.focus())
          }}
          onOpenPrivacy={() => setScreen('privacy')}
        />
      )}
      {screen === 'privacy' && <PrivacySettings onBack={() => setScreen('account')} />}
    </>
  )
}

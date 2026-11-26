import { describe, expect, it } from 'vitest'
import { AuthFailure } from '../errors'
import { createSupabaseAuthService, type AuthSession, type SupabaseAuthApi } from '../service'

const APP_URL = 'https://shelfie.example.test/app/'
const EMAIL = 'person@example.test'
const PASSWORD = 'invented-password-1'
const SESSION = { user: { id: 'user-1', email: EMAIL }, access_token: 'invented-token' }

type Call = { method: string; args: unknown[] }

/** A fake of supabase.auth that records each call and answers with `answers[method]` if given. */
function fakeAuth(answers: Partial<Record<keyof SupabaseAuthApi, unknown>> = {}) {
  const calls: Call[] = []
  const listeners: ((event: string, session: unknown) => void)[] = []
  let unsubscribed = 0
  const answer =
    (method: keyof SupabaseAuthApi, fallback: unknown) =>
    async (...args: unknown[]) => {
      calls.push({ method, args })
      const value = method in answers ? answers[method] : fallback
      if (value instanceof Error) throw value
      return value
    }
  const auth = {
    signUp: answer('signUp', { data: { session: null, user: { id: 'user-1' } }, error: null }),
    signInWithPassword: answer('signInWithPassword', { data: { session: SESSION }, error: null }),
    signOut: answer('signOut', { error: null }),
    resetPasswordForEmail: answer('resetPasswordForEmail', { data: {}, error: null }),
    updateUser: answer('updateUser', { data: {}, error: null }),
    resend: answer('resend', { data: {}, error: null }),
    getSession: answer('getSession', { data: { session: SESSION }, error: null }),
    onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
      calls.push({ method: 'onAuthStateChange', args: [] })
      listeners.push(callback)
      return { data: { subscription: { unsubscribe: () => void (unsubscribed += 1) } } }
    },
  } as unknown as SupabaseAuthApi
  return { auth, calls, listeners, unsubscribedCount: () => unsubscribed }
}

function setup(answers?: Parameters<typeof fakeAuth>[0]) {
  const fake = fakeAuth(answers)
  const keepChoices: boolean[] = []
  let created = 0
  const service = createSupabaseAuthService({
    createClient: () => {
      created += 1
      return { auth: fake.auth }
    },
    setKeepSignedIn: (keep) => keepChoices.push(keep),
    appUrl: APP_URL,
  })
  return { service, ...fake, keepChoices, createdCount: () => created }
}

const rejection = (code: string) => expect.objectContaining({ name: 'AuthFailure', code })

describe('SupabaseAuthService', () => {
  it('creates the client once, through the factory', () => {
    const { createdCount } = setup()
    expect(createdCount()).toBe(1)
  })

  it('signUp sends email and password, with the confirmation link back to the app', async () => {
    const { service, calls } = setup()
    await expect(service.signUp(` ${EMAIL} `, PASSWORD)).resolves.toEqual({
      needsConfirmation: true,
    })
    expect(calls).toEqual([
      {
        method: 'signUp',
        args: [{ email: EMAIL, password: PASSWORD, options: { emailRedirectTo: APP_URL } }],
      },
    ])
  })

  it('signUp reports no confirmation needed when a session comes back', async () => {
    const { service } = setup({ signUp: { data: { session: SESSION }, error: null } })
    await expect(service.signUp(EMAIL, PASSWORD)).resolves.toEqual({ needsConfirmation: false })
  })

  it('signUp refuses a short password before calling Supabase', async () => {
    const { service, calls } = setup()
    await expect(service.signUp(EMAIL, 'short')).rejects.toEqual(rejection('weakPassword'))
    expect(calls).toEqual([])
  })

  it('signUp maps an email already in use', async () => {
    const { service } = setup({
      signUp: { data: { session: null }, error: { code: 'email_exists', status: 422 } },
    })
    await expect(service.signUp(EMAIL, PASSWORD)).rejects.toEqual(rejection('emailInUse'))
  })

  it.each([true, false])(
    'signIn chooses the session storage (keep signed in: %s) before signing in',
    async (keep) => {
      const { service, calls, keepChoices } = setup()
      const session = await service.signIn(EMAIL, PASSWORD, keep)
      expect(keepChoices).toEqual([keep])
      expect(calls).toEqual([
        { method: 'signInWithPassword', args: [{ email: EMAIL, password: PASSWORD }] },
      ])
      // Only the id and email come out: no tokens.
      expect(session).toEqual<AuthSession>({ user: { id: 'user-1', email: EMAIL } })
    },
  )

  it('signIn gives a wrong password and an unknown email the same failure', async () => {
    const wrong = setup({
      signInWithPassword: { data: { session: null }, error: { code: 'invalid_credentials' } },
    })
    const unknown = setup({
      signInWithPassword: { data: { session: null }, error: { code: 'user_not_found' } },
    })
    const a = await wrong.service.signIn(EMAIL, PASSWORD, true).catch((e: unknown) => e)
    const b = await unknown.service.signIn(EMAIL, PASSWORD, true).catch((e: unknown) => e)
    expect(a).toBeInstanceOf(AuthFailure)
    expect(b).toEqual(a)
  })

  it('signIn turns a failed fetch into a network failure', async () => {
    const { service } = setup({ signInWithPassword: new TypeError('Failed to fetch') })
    await expect(service.signIn(EMAIL, PASSWORD, true)).rejects.toEqual(rejection('network'))
  })

  it('signOut signs out this device only', async () => {
    const { service, calls } = setup()
    await service.signOut()
    expect(calls).toEqual([{ method: 'signOut', args: [{ scope: 'local' }] }])
  })

  it("signOutOthers uses scope 'others'", async () => {
    const { service, calls } = setup()
    await service.signOutOthers()
    expect(calls).toEqual([{ method: 'signOut', args: [{ scope: 'others' }] }])
  })

  it('resendConfirmation sends the sign-up email again, linking back to the app', async () => {
    const { service, calls } = setup()
    await service.resendConfirmation(` ${EMAIL}`)
    expect(calls).toEqual([
      {
        method: 'resend',
        args: [{ type: 'signup', email: EMAIL, options: { emailRedirectTo: APP_URL } }],
      },
    ])
  })

  it('requestPasswordReset links back to /app/reset-password/', async () => {
    const { service, calls } = setup()
    await service.requestPasswordReset(EMAIL)
    expect(calls).toEqual([
      {
        method: 'resetPasswordForEmail',
        args: [EMAIL, { redirectTo: 'https://shelfie.example.test/app/reset-password/' }],
      },
    ])
  })

  it('requestPasswordReset passes on a rate limit', async () => {
    const { service } = setup({
      resetPasswordForEmail: { data: null, error: { code: 'over_email_send_rate_limit' } },
    })
    await expect(service.requestPasswordReset(EMAIL)).rejects.toEqual(rejection('rateLimited'))
  })

  it('confirmPassword signs in again as the current account, keeping the storage choice', async () => {
    const { service, calls, keepChoices } = setup()
    await service.confirmPassword(PASSWORD)
    expect(calls).toEqual([
      { method: 'getSession', args: [] },
      { method: 'signInWithPassword', args: [{ email: EMAIL, password: PASSWORD }] },
    ])
    expect(keepChoices).toEqual([])
  })

  it('confirmPassword asks to sign in again when there is no session', async () => {
    const { service } = setup({ getSession: { data: { session: null }, error: null } })
    await expect(service.confirmPassword(PASSWORD)).rejects.toEqual(rejection('signInAgain'))
  })

  it('updatePassword checks the rule, then updates the user', async () => {
    const { service, calls } = setup()
    await expect(service.updatePassword('short')).rejects.toEqual(rejection('weakPassword'))
    await service.updatePassword('a-new-invented-password')
    expect(calls).toEqual([
      { method: 'updateUser', args: [{ password: 'a-new-invented-password' }] },
    ])
  })

  it('updateEmail asks Supabase to confirm the new address, with the link back to the app', async () => {
    const { service, calls } = setup()
    await service.updateEmail('new.person@example.test')
    expect(calls).toEqual([
      {
        method: 'updateUser',
        args: [{ email: 'new.person@example.test' }, { emailRedirectTo: APP_URL }],
      },
    ])
  })

  it('getSession returns only the user, or null', async () => {
    await expect(setup().service.getSession()).resolves.toEqual({
      user: { id: 'user-1', email: EMAIL },
    })
    const none = setup({ getSession: { data: { session: null }, error: null } })
    await expect(none.service.getSession()).resolves.toBeNull()
  })

  it('onAuthStateChange passes on each session and unsubscribes', () => {
    const { service, listeners, unsubscribedCount } = setup()
    const seen: (AuthSession | null)[] = []
    const stop = service.onAuthStateChange((session) => seen.push(session))

    listeners[0]?.('SIGNED_IN', SESSION)
    listeners[0]?.('SIGNED_OUT', null)
    expect(seen).toEqual([{ user: { id: 'user-1', email: EMAIL } }, null])

    stop()
    expect(unsubscribedCount()).toBe(1)
  })

  it('deleteAccount is not available yet', async () => {
    const { service, calls } = setup()
    await expect(service.deleteAccount()).rejects.toThrow('not available yet')
    expect(calls).toEqual([])
  })
})

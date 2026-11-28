// @vitest-environment jsdom
// The sign-in screens with a fake AuthService: validation, the password tools, the same message for
// an unknown account, the resend countdown and the web tabs. Invented addresses only.

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthFailure } from '../../../auth/errors'
import { AuthScreens } from '../AuthScreens'
import { RESEND_AFTER_SECONDS } from '../CheckEmail'
import { COPIED_FOR_MS } from '../PasswordTools'
import { keepSignedInLabel } from '../SignIn'
import { fakeAuthService, renderWithAuth, setWide } from './helpers'

const EMAIL = 'person@example.test'
const GENERATED = 'Cobalt-Maple-River-Tulip-42!'

beforeEach(() => setWide(false))

const field = (name: string) => screen.getByLabelText(name, { selector: 'input' })

describe('Create account (phone)', () => {
  it('shows the phone design: jar, wordmark, the two tabs, three pills and the terms', () => {
    renderWithAuth(<AuthScreens />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Create your Shelfie account' }),
    ).toBeTruthy()
    expect(screen.getByText('Shelfie')).toBeTruthy()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Create account',
      'Sign in',
    ])
    expect(screen.getByRole('tab', { name: 'Create account' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'Generate password' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy()
    const terms = screen.getByRole('link', { name: /Terms/ })
    expect(terms.getAttribute('href')).toBe('/terms')
    expect(terms.getAttribute('target')).toBe('_blank')
    expect(terms.getAttribute('rel')).toBe('noopener')
    expect(screen.getByRole('link', { name: /Privacy notice/ }).getAttribute('href')).toBe(
      '/privacy',
    )
    expect(screen.queryByText(/Already have an account/)).toBeNull()
    // The design's footer line was dropped (owner, 28 Nov 2026).
    expect(screen.queryByText(/Made for the bathroom cupboard/)).toBeNull()
    expect(document.body.textContent).not.toMatch(/claude/i)
  })

  it('draws leaves in both corners on the phone entry page, and only top right elsewhere', async () => {
    const bottomLeft = () => document.querySelector('svg[viewBox="-40 690 250 230"]')
    const { user } = renderWithAuth(<AuthScreens />)
    expect(bottomLeft()?.getAttribute('class')).not.toMatch(/(^|\s)hidden(\s|$)/)
    await user.click(screen.getByRole('tab', { name: 'Sign in' }))
    expect(bottomLeft()?.getAttribute('class')).not.toMatch(/(^|\s)hidden(\s|$)/)
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(bottomLeft()?.getAttribute('class')).toMatch(/(^|\s)hidden(\s|$)/)
  })

  it('Clear empties the password, then is off, and focus goes back to the field', async () => {
    const { user } = renderWithAuth(<AuthScreens generate={() => GENERATED} />)
    const clear = screen.getByRole('button', { name: 'Clear' })
    expect(clear.hasAttribute('disabled')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Generate password' }))
    expect(clear.hasAttribute('disabled')).toBe(false)
    await user.click(clear)
    const password = field('Password') as HTMLInputElement
    expect(password.value).toBe('')
    expect(clear.hasAttribute('disabled')).toBe(true)
    expect(document.activeElement).toBe(password)
  })

  it('the Sign in tab switches to the sign-in form', async () => {
    const { user } = renderWithAuth(<AuthScreens />)
    await user.click(screen.getByRole('tab', { name: 'Sign in' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to Shelfie' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
  })

  it('uses the autocomplete hints password managers need', () => {
    renderWithAuth(<AuthScreens />)
    expect(field('Email').getAttribute('autocomplete')).toBe('username')
    expect(field('Email').getAttribute('type')).toBe('email')
    expect(field('Password').getAttribute('autocomplete')).toBe('new-password')
  })

  it('on submit, shows each problem by its field and focuses the summary', async () => {
    const { service } = fakeAuthService()
    const { user } = renderWithAuth(<AuthScreens />, service)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      screen.getByText('Enter your email.', { selector: '[slot="errorMessage"]' }),
    ).toBeTruthy()
    expect(
      screen.getByText('Enter a password, or generate one.', { selector: '[slot="errorMessage"]' }),
    ).toBeTruthy()
    const summary = document.activeElement as HTMLElement
    expect(summary.getAttribute('aria-live')).toBe('polite')
    expect(summary.textContent).toBe(
      'There are 2 problems: Enter your email. Enter a password, or generate one.',
    )
    expect(service.signUp).not.toHaveBeenCalled()
  })

  it('checks the email and the 10-character rule on blur', async () => {
    const { user } = renderWithAuth(<AuthScreens />)
    await user.type(field('Email'), 'person')
    await user.tab()
    expect(screen.getByText('Enter an email like name@example.com.')).toBeTruthy()

    await user.type(field('Password'), 'short')
    await user.tab()
    expect(screen.getByText('Use at least 10 characters.')).toBeTruthy()
  })

  it('Generate password fills the field and shows it', async () => {
    const { user } = renderWithAuth(<AuthScreens generate={() => GENERATED} />)
    const password = field('Password') as HTMLInputElement
    expect(password.type).toBe('password')

    await user.click(screen.getByRole('button', { name: 'Generate password' }))
    expect(password.value).toBe(GENERATED)
    expect(password.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('the eye button shows and hides the password', async () => {
    const { user } = renderWithAuth(<AuthScreens />)
    const password = field('Password') as HTMLInputElement
    const show = screen.getByRole('button', { name: 'Show password' })
    expect(show.getAttribute('aria-pressed')).toBe('false')

    await user.click(show)
    expect(password.type).toBe('text')
    const hide = screen.getByRole('button', { name: 'Hide password' })
    expect(hide.getAttribute('aria-pressed')).toBe('true')

    await user.click(hide)
    expect(password.type).toBe('password')
  })

  it('Copy is off until there is a password, copies it and says Copied for 2 seconds', async () => {
    const writeClipboard = vi.fn(async () => {})
    renderWithAuth(<AuthScreens writeClipboard={writeClipboard} />)
    const copy = screen.getByRole('button', { name: 'Copy' })
    expect(copy.hasAttribute('disabled')).toBe(true)

    fireEvent.change(field('Password'), { target: { value: 'a-typed-password' } })
    expect(copy.hasAttribute('disabled')).toBe(false)

    vi.useFakeTimers()
    fireEvent.click(copy)
    await act(async () => {})
    expect(writeClipboard).toHaveBeenCalledWith('a-typed-password')
    const status = screen.getByText('Copied')
    expect(status.getAttribute('role')).toBe('status')

    act(() => vi.advanceTimersByTime(COPIED_FOR_MS))
    expect(screen.queryByText('Copied')).toBeNull()
  })

  it('creates the account, then shows Check your email with the address', async () => {
    const { service } = fakeAuthService()
    const { user } = renderWithAuth(<AuthScreens generate={() => GENERATED} />, service)
    await user.type(field('Email'), EMAIL)
    await user.click(screen.getByRole('button', { name: 'Generate password' }))
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(service.signUp).toHaveBeenCalledWith(EMAIL, GENERATED)
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeTruthy()
    expect(screen.getByText(EMAIL)).toBeTruthy()
  })

  it('sends one request however often the button is pressed, and disables it meanwhile', async () => {
    const { service } = fakeAuthService()
    let finish: () => void = () => {}
    service.signUp.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ needsConfirmation: false })
        }),
    )
    renderWithAuth(<AuthScreens />, service)
    fireEvent.change(field('Email'), { target: { value: EMAIL } })
    fireEvent.change(field('Password'), { target: { value: 'a-long-enough-pw' } })
    const button = screen.getByRole('button', { name: 'Create account' })
    fireEvent.submit(button.closest('form') as HTMLFormElement)
    fireEvent.submit(button.closest('form') as HTMLFormElement)
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(true))
    expect(service.signUp).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('says to retry when the network is down', async () => {
    const { service } = fakeAuthService()
    service.signUp.mockRejectedValue(new AuthFailure('network'))
    const { user } = renderWithAuth(<AuthScreens />, service)
    await user.type(field('Email'), EMAIL)
    await user.type(field('Password'), 'a-long-enough-pw')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() =>
      expect((document.activeElement as HTMLElement).textContent).toBe(
        "Can't reach Shelfie. Check your connection and try again.",
      ),
    )
  })
})

describe('Sign in', () => {
  async function openSignIn() {
    const fake = fakeAuthService()
    const rendered = renderWithAuth(<AuthScreens initialView="signIn" />, fake.service)
    return { ...fake, ...rendered }
  }

  it('shows the phone design: Forgot password?, the checkbox, no Create an account line', async () => {
    await openSignIn()
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to Shelfie' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Sign in' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeTruthy()
    expect(
      (screen.getByRole('checkbox', { name: keepSignedInLabel(false) }) as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect(screen.queryByRole('button', { name: 'Create an account' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    expect(field('Password').getAttribute('autocomplete')).toBe('current-password')
    expect(screen.queryByText(/Made for the bathroom cupboard/)).toBeNull()
  })

  it('labels the checkbox for the device it runs on', () => {
    expect(keepSignedInLabel(false)).toBe('Keep me signed in on this device')
    expect(keepSignedInLabel(true)).toBe('Keep me signed in on this phone')
  })

  it('signs in with the keep-signed-in choice', async () => {
    const { service, user } = await openSignIn()
    await user.type(field('Email'), EMAIL)
    await user.type(field('Password'), 'any-password')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(service.signIn).toHaveBeenCalledWith(EMAIL, 'any-password', false)
  })

  it('shows the same message for a wrong password and an unknown account', async () => {
    const messages: string[] = []
    for (const supabaseCode of ['invalid_credentials', 'user_not_found']) {
      const { service, user, unmount } = await openSignIn()
      service.signIn.mockRejectedValue(
        Object.assign(new Error('raw'), { name: 'AuthApiError', code: supabaseCode }),
      )
      await user.type(field('Email'), EMAIL)
      await user.type(field('Password'), 'any-password')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      await waitFor(() => expect(document.activeElement?.getAttribute('aria-live')).toBe('polite'))
      messages.push(document.activeElement?.textContent ?? '')
      unmount()
    }
    expect(messages[0]).toBe("That email and password don't match. Check them and try again.")
    expect(messages[1]).toBe(messages[0])
  })

  it('moves focus to the first field when the screen changes', async () => {
    const { user } = await openSignIn()
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(screen.getByRole('heading', { name: 'Forgot password' })).toBeTruthy()
    expect(document.activeElement).toBe(field('Email'))
  })
})

describe('Forgot password', () => {
  it('always shows the same confirmation, whether or not the address has an account', async () => {
    for (const outcome of ['sent', 'no account'] as const) {
      const { service } = fakeAuthService()
      if (outcome === 'no account') {
        service.requestPasswordReset.mockRejectedValue(
          Object.assign(new Error('raw'), { name: 'AuthApiError', code: 'user_not_found' }),
        )
      }
      const { user, unmount } = renderWithAuth(<AuthScreens initialView="forgot" />, service)
      await user.type(field('Email'), EMAIL)
      await user.click(screen.getByRole('button', { name: 'Send reset link' }))
      expect(
        await screen.findByText('If that address has an account, we have sent a link.'),
      ).toBeTruthy()
      expect(service.requestPasswordReset).toHaveBeenCalledWith(EMAIL)
      unmount()
    }
  })

  it('shows a network problem instead of moving on', async () => {
    const { service } = fakeAuthService()
    service.requestPasswordReset.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user } = renderWithAuth(<AuthScreens initialView="forgot" />, service)
    await user.type(field('Email'), EMAIL)
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(
      await screen.findByText("Can't reach Shelfie. Check your connection and try again."),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Forgot password' })).toBeTruthy()
  })
})

describe('Check your email', () => {
  it('lets Resend email run once a minute, with a visible countdown', async () => {
    vi.useFakeTimers()
    const { service } = fakeAuthService()
    renderWithAuth(<AuthScreens initialView="checkSignup" />, service)
    const resend = screen.getByRole('button', { name: 'Resend email' })
    expect(resend.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(`You can send it again in ${RESEND_AFTER_SECONDS} s.`)).toBeTruthy()

    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText(`You can send it again in ${RESEND_AFTER_SECONDS - 1} s.`)).toBeTruthy()

    for (let i = 1; i < RESEND_AFTER_SECONDS; i += 1) act(() => vi.advanceTimersByTime(1000))
    expect(resend.hasAttribute('disabled')).toBe(false)

    fireEvent.click(resend)
    await act(async () => {})
    expect(service.resendConfirmation).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sent again.')).toBeTruthy()
    expect(resend.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(`You can send it again in ${RESEND_AFTER_SECONDS} s.`)).toBeTruthy()
  })

  it('Use a different email goes back to an empty form', async () => {
    const { user } = renderWithAuth(<AuthScreens initialView="checkSignup" />)
    await user.click(screen.getByRole('button', { name: 'Use a different email' }))
    expect(screen.getByRole('heading', { name: 'Create your Shelfie account' })).toBeTruthy()
    expect((field('Email') as HTMLInputElement).value).toBe('')
  })
})

describe('Reset password', () => {
  it('saves the new password, signs out other devices, then opens the app', async () => {
    const { service } = fakeAuthService()
    const onResetDone = vi.fn()
    const { user } = renderWithAuth(
      <AuthScreens
        initialView="reset"
        accountEmail={EMAIL}
        onResetDone={onResetDone}
        generate={() => GENERATED}
      />,
      service,
    )
    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(
      screen.getByText('Enter a password, or generate one.', { selector: '[slot="errorMessage"]' }),
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Generate password' }))
    expect(field('New password').getAttribute('autocomplete')).toBe('new-password')
    await user.click(screen.getByRole('button', { name: 'Save new password' }))
    await waitFor(() => expect(onResetDone).toHaveBeenCalled())
    expect(service.updatePassword).toHaveBeenCalledWith(GENERATED)
    expect(service.signOutOthers).toHaveBeenCalled()
  })
})

describe('web layout', () => {
  beforeEach(() => setWide(true))

  it('shows the brand panel and a card with Create account and Sign in tabs', async () => {
    const { user } = renderWithAuth(<AuthScreens />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Stop keeping the bathroom cabinet in your head.',
    )
    expect(screen.getByText('Restock on time')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Create Your Account' })).toBeTruthy()
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual(['Create account', 'Sign in'])

    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Sign in' }))
    expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in on this device' })).toBeTruthy()
  })
})

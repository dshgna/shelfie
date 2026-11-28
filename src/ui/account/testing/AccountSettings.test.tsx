// @vitest-environment jsdom
// Account settings with a fake AuthService: each section, the confirm dialogs and the error states.
// Invented addresses and user agents only.

import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthFailure } from '../../../auth/errors'
import { AccountSettings, PrivacySettings } from '../AccountSettings'
import { ALEX, fakeAuthService, renderWithAuth, setWide } from '../../auth/testing/helpers'

const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const GENERATED = 'Cobalt-Maple-River-Tulip-42!'

beforeEach(() => setWide(false))

async function open(options: { wide?: boolean } = {}) {
  setWide(options.wide ?? false)
  const fake = fakeAuthService(ALEX)
  const onClose = vi.fn()
  const onOpenPrivacy = vi.fn()
  const rendered = renderWithAuth(
    <AccountSettings
      onClose={onClose}
      onOpenPrivacy={onOpenPrivacy}
      userAgent={SAFARI_IPHONE}
      generate={() => GENERATED}
    />,
    fake.service,
  )
  await screen.findByText(ALEX.user.email)
  return { ...fake, ...rendered, onClose, onOpenPrivacy }
}

const sectionNames = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

describe('Account settings layout', () => {
  it('phone: one column in order, Back first, Sign out last', async () => {
    const { user, onClose } = await open()
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeTruthy()
    expect(sectionNames()).toEqual(['Sign-in', 'Privacy', 'Devices', 'Your data'])
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Back to shelves')
    expect(buttons.at(-1)?.textContent).toBe('Sign out')
    await user.click(buttons[0] as HTMLElement)
    expect(onClose).toHaveBeenCalled()
    expect(document.body.textContent).not.toMatch(/claude/i)
  })

  it('web: Sign-In and Privacy in the left column, Devices and Your Data in the right, no Sign out', async () => {
    await open({ wide: true })
    const columns = screen.getByRole('main').children
    expect(columns).toHaveLength(2)
    const names = (column: Element) =>
      within(column as HTMLElement)
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.textContent)
    expect(names(columns[0] as Element)).toEqual(['Sign-In', 'Privacy'])
    expect(names(columns[1] as Element)).toEqual(['Devices', 'Your Data'])
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})

describe('Sign-in section', () => {
  it('changes the email and asks to confirm the new address', async () => {
    const { service, user } = await open()
    await user.click(screen.getByRole('button', { name: 'Change email' }))
    const field = screen.getByLabelText('New email')
    expect(document.activeElement).toBe(field)
    await user.click(screen.getByRole('button', { name: 'Save email' }))
    expect(screen.getAllByText('Enter your email.').length).toBeGreaterThan(0)
    expect(service.updateEmail).not.toHaveBeenCalled()

    await user.type(field, 'new.person@example.test')
    await user.click(screen.getByRole('button', { name: 'Save email' }))
    expect(service.updateEmail).toHaveBeenCalledWith('new.person@example.test')
    expect(await screen.findByText('Check your new address to confirm.')).toBeTruthy()
  })

  it('changes the password with Generate password', async () => {
    const { service, user } = await open()
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    await user.click(screen.getByRole('button', { name: 'Generate password' }))
    const field = screen.getByLabelText('New password', { selector: 'input' }) as HTMLInputElement
    expect(field.value).toBe(GENERATED)
    expect(field.getAttribute('autocomplete')).toBe('new-password')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save password' }))
    expect(service.updatePassword).toHaveBeenCalledWith(GENERATED)
    expect(await screen.findByText('Password changed.')).toBeTruthy()
  })

  it('asks to sign in again when Supabase needs a recent sign-in, then retries', async () => {
    const { service, user } = await open()
    service.updatePassword.mockRejectedValueOnce(new AuthFailure('signInAgain'))
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    await user.click(screen.getByRole('button', { name: 'Generate password' }))
    await user.click(screen.getByRole('button', { name: 'Save password' }))

    expect(await screen.findByText('Please sign in again to change this.')).toBeTruthy()
    const password = screen.getByLabelText('Password', { selector: 'input' })
    expect(password.getAttribute('autocomplete')).toBe('current-password')
    await user.type(password, 'the-current-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(service.confirmPassword).toHaveBeenCalledWith('the-current-password')
    await waitFor(() => expect(service.updatePassword).toHaveBeenCalledTimes(2))
    expect(service.updatePassword).toHaveBeenLastCalledWith(GENERATED)
    expect(await screen.findByText('Password changed.')).toBeTruthy()
  })

  it('shows a mapped error inline, never the raw one', async () => {
    const { service, user } = await open()
    service.updateEmail.mockRejectedValueOnce(
      Object.assign(new Error('raw server text'), { name: 'AuthApiError', code: 'email_exists' }),
    )
    await user.click(screen.getByRole('button', { name: 'Change email' }))
    await user.type(screen.getByLabelText('New email'), 'taken@example.test')
    await user.click(screen.getByRole('button', { name: 'Save email' }))
    expect(
      await screen.findByText('There is already an account with this email. Try signing in.'),
    ).toBeTruthy()
    expect(document.body.textContent).not.toContain('raw server text')
  })
})

describe('Privacy section', () => {
  it('opens Analytics and privacy', async () => {
    const { user, onOpenPrivacy } = await open()
    await user.click(screen.getByRole('button', { name: 'Analytics and privacy' }))
    expect(onOpenPrivacy).toHaveBeenCalled()
  })

  it('the placeholder has the heading only', () => {
    renderWithAuth(<PrivacySettings onBack={() => {}} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics and privacy' })).toBeTruthy()
  })
})

describe('Devices section', () => {
  it('names this device from the browser family only', async () => {
    await open()
    expect(screen.getByText('Safari on iPhone')).toBeTruthy()
    expect(screen.getByText('This phone · Signed in now')).toBeTruthy()
    expect(document.body.textContent).not.toContain('AppleWebKit')
  })

  it('signs out other devices only after the confirm dialog', async () => {
    const { service, user } = await open()
    await user.click(screen.getByRole('button', { name: 'Sign out other devices' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Sign out other devices?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(service.signOutOthers).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Sign out other devices' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Sign out other devices',
      }),
    )
    expect(service.signOutOthers).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Signed out of other devices')).toBeTruthy()
  })

  it('says when signing out other devices fails', async () => {
    const { service, user } = await open()
    service.signOutOthers.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await user.click(screen.getByRole('button', { name: 'Sign out other devices' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Sign out other devices',
      }),
    )
    expect(
      await screen.findByText("Can't reach Shelfie. Check your connection and try again."),
    ).toBeTruthy()
  })
})

describe('Your data section', () => {
  it('shows Export as Planned', async () => {
    await open()
    const row = screen.getByText('Export my data').parentElement?.parentElement as HTMLElement
    expect(within(row).getByText('Planned')).toBeTruthy()
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('Delete account asks for the email, but stays off until deletion exists', async () => {
    const { service, user } = await open()
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete your account?' })
    await user.type(within(dialog).getByLabelText('Type your email to confirm'), ALEX.user.email)
    const confirm = within(dialog).getByRole('button', { name: 'Delete account' })
    expect(confirm.hasAttribute('disabled')).toBe(true)
    expect(within(dialog).getByText('Planned')).toBeTruthy()
    expect(
      within(dialog).getByText('Deleting your account will be available before launch.'),
    ).toBeTruthy()
    expect(service.deleteAccount).not.toHaveBeenCalled()
  })
})

describe('Sign out', () => {
  it('signs out (this device only) from the phone layout', async () => {
    const { service, user } = await open()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(service.signOut).toHaveBeenCalledTimes(1)
  })

  it('shows a problem if signing out fails', async () => {
    const { service, user } = await open()
    service.signOut.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(
      await screen.findByText("Can't reach Shelfie. Check your connection and try again."),
    ).toBeTruthy()
  })
})

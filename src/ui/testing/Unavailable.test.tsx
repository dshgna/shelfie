// @vitest-environment jsdom
// The page is never blank: a render error and a build without Supabase settings both show the
// plain "can't start" screen, with no technical text.

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { AuthProvider } from '../../auth/AuthProvider'
import { ConfigurationError } from '../../auth/errors'
import { fakeAuthService } from '../auth/testing/helpers'
import { ErrorBoundary } from '../ErrorBoundary'
import { UNAVAILABLE_MESSAGE } from '../Unavailable'

afterEach(() => vi.restoreAllMocks())

function Broken(): never {
  throw new Error('Invented render failure')
}

function expectPlainScreen() {
  expect(screen.getByRole('heading', { level: 1, name: UNAVAILABLE_MESSAGE })).toBeTruthy()
  expect(screen.getByText('Shelfie')).toBeTruthy()
  const text = document.body.textContent ?? ''
  expect(text).not.toMatch(/VITE_|supabase|error|claude/i)
}

describe('the plain unavailable screen', () => {
  it('the error boundary shows it when rendering throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )
    expectPlainScreen()
  })

  it('the error boundary shows its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>Invented shelves</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Invented shelves')).toBeTruthy()
  })

  it('App shows it when the build has no Supabase settings', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { service } = fakeAuthService()
    service.getSession.mockRejectedValue(new ConfigurationError('VITE_SUPABASE_URL'))
    render(
      <AuthProvider service={service}>
        <App />
      </AuthProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: UNAVAILABLE_MESSAGE })).toBeTruthy()
    expectPlainScreen()
    expect(String(errors.mock.calls[0]?.[0])).toContain('VITE_SUPABASE_URL')
  })
})

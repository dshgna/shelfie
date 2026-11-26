// Shared submit handling for the sign-in forms: one request at a time (the button is disabled and
// a second submit is ignored while one is in flight), Shelfie's own wording for any failure, and
// focus on the error summary when a submit fails. Nothing here logs or stores what was typed.

import { useRef, useState } from 'react'
import { AUTH_ERROR_MESSAGES, toAuthErrorCode, type AuthErrorCode } from '../../auth/errors'

export function messageFor(error: unknown): string {
  return AUTH_ERROR_MESSAGES[toAuthErrorCode(error)]
}

export function useAuthSubmit() {
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<string | undefined>()
  const inFlight = useRef(false)
  const problemRef = useRef<HTMLDivElement>(null)

  /** Shows a problem in the summary and moves focus there. */
  const fail = (message: string) => {
    setProblem(message)
    problemRef.current?.focus()
  }

  /**
   * Runs the request unless one is already running. `onError` may give a screen-specific message
   * for a code; otherwise the shared wording is used.
   */
  const run = async (
    request: () => Promise<void>,
    onError?: (code: AuthErrorCode) => string | undefined,
  ): Promise<boolean> => {
    if (inFlight.current) return false
    inFlight.current = true
    setPending(true)
    setProblem(undefined)
    try {
      await request()
      return true
    } catch (error) {
      const code = toAuthErrorCode(error)
      fail(onError?.(code) ?? AUTH_ERROR_MESSAGES[code])
      return false
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return { pending, problem, problemRef, fail, clearProblem: () => setProblem(undefined), run }
}

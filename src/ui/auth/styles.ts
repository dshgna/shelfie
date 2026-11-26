// Class names shared by the sign-in screens, drawn from the design (prototype-create-account-sign-in)
// with the tokens: no colour or font literals.

export const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** 48px fields with the --edge border, as on the design. */
export const AUTH_INPUT = `h-12 w-full min-w-0 rounded-xl border border-edge bg-surface px-3.5 text-base text-ink data-invalid:border-danger ${FOCUS}`

export const LABEL = 'text-sm leading-none font-semibold text-ink'

/** The main action: full width, 52px. Text is --surface, which stays readable on --accent in dark mode. */
export const PRIMARY = `inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-base font-semibold text-surface data-disabled:opacity-60 data-hovered:opacity-90 ${FOCUS}`

export const SECONDARY = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-edge bg-surface px-4 text-base font-semibold text-ink data-disabled:opacity-60 data-hovered:bg-surface-2 ${FOCUS}`

/** Underlined teal text link (Forgot password?, Back to sign in), 44px tall. */
export const TEXT_LINK = `inline-flex min-h-[44px] items-center text-[15px] font-semibold text-accent underline ${FOCUS}`

/** The teal link inside a sentence (Sign in, Create an account, Terms). */
export const INLINE_LINK = `font-semibold text-accent underline-offset-2 hover:underline ${FOCUS}`

export const FIELD_ERROR = 'text-sm font-semibold text-danger'

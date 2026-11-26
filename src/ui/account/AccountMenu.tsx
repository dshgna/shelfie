// The header's account menu: Account settings and Sign out. Sign out keeps the shelves on this
// device (signOut only ends this device's session) and returns to the sign-in screen.

import { useState } from 'react'
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { useAuth } from '../../auth/useAuth'
import { FOCUS_RING } from '../fields'
import { FOCUS } from '../auth/styles'
import { messageFor } from '../auth/useAuthSubmit'
import { UserIcon } from './parts'

export const ACCOUNT_MENU_ID = 'account-menu-button'

const ITEM = `flex min-h-[44px] cursor-default items-center rounded-lg px-3 text-base text-ink outline-none data-focused:bg-surface-2 ${FOCUS_RING}`

export function AccountMenu({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { signOut } = useAuth()
  const [problem, setProblem] = useState('')
  return (
    <div className="relative">
      <MenuTrigger>
        <Button
          id={ACCOUNT_MENU_ID}
          aria-label="Account menu"
          className={`grid size-[44px] place-items-center rounded-xl border border-edge bg-surface text-ink data-hovered:bg-surface-2 data-pressed:bg-surface-2 ${FOCUS}`}
        >
          <UserIcon />
        </Button>
        <Popover
          placement="bottom end"
          className="min-w-48 rounded-xl border border-line bg-surface p-1 shadow-lg shadow-ink/10"
        >
          <Menu
            className="outline-none"
            onAction={(key) => {
              if (key === 'account') onOpenAccount()
              if (key === 'sign-out') {
                setProblem('')
                signOut().catch((error: unknown) => setProblem(messageFor(error)))
              }
            }}
          >
            <MenuItem id="account" className={ITEM}>
              Account settings
            </MenuItem>
            <MenuItem id="sign-out" className={ITEM}>
              Sign out
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p
        aria-live="polite"
        className="absolute top-full right-0 z-10 m-0 mt-1 w-max max-w-64 text-sm font-semibold text-danger"
      >
        {problem}
      </p>
    </div>
  )
}

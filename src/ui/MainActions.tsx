import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from 'react-aria-components'

// Design rule 7: same size, white text; Fill my shelves on --accent, Shop now on --ink.
// 168px each on web, equal halves on phone.
const ACTION =
  'inline-flex h-[44px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 font-semibold text-white md:w-[168px] md:flex-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-hovered:opacity-90'

const ICON = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function FillPlaceholder() {
  return (
    <ModalOverlay isDismissable className="fixed inset-0 z-10 grid place-items-center bg-bg/80 p-4">
      <Modal className="w-full max-w-md rounded-3xl border border-line bg-surface p-6">
        <Dialog className="flex flex-col gap-3 outline-none">
          {({ close }) => (
            <>
              <Heading slot="title" className="font-display text-2xl font-semibold">
                Fill my shelves
              </Heading>
              <p className="text-muted">
                This is where you will paste an order or add screenshots. It isn't ready yet.
              </p>
              <Button
                onPress={close}
                className="min-h-[44px] self-end rounded-xl border border-edge bg-surface px-4 font-semibold hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Close
              </Button>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

export function MainActions({ onShopNow }: { onShopNow: () => void }) {
  return (
    <div className="flex w-full gap-2 md:w-auto">
      <DialogTrigger>
        <Button className={`${ACTION} border-accent bg-accent`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...ICON}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Fill my shelves
        </Button>
        <FillPlaceholder />
      </DialogTrigger>
      <Button className={`${ACTION} border-ink bg-ink`} onPress={onShopNow}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...ICON}>
          <path d="M3 4h2.5l2.2 11h10.6l2-8H6.4" />
          <circle cx="9.5" cy="19" r="1.4" />
          <circle cx="17" cy="19" r="1.4" />
        </svg>
        Shop now
      </Button>
    </div>
  )
}

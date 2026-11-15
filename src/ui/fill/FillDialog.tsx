// "Fill my shelves": Orders, Review and Done, in one dialog. Ported from the prototype's fill
// flow and the design canvas's Fill screens. Screens only: reading the orders uses the mock in
// read-orders.ts (no AI, no network). The review rows live in this component's state only, so
// closing the dialog discards them. Adding saves through ItemRepository, each row as an item (new
// or topped up) with a purchase record.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  Heading,
  Label,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
  Text,
  TextArea,
  TextField,
} from 'react-aria-components'
import type { IsoDate } from '../../domain/dates'
import type { Item } from '../../domain/item'
import {
  MAX_LENGTH,
  firstGroup,
  groupOptions,
  type FormErrors,
  type FormValues,
} from '../item-form'
import type { ItemRepository } from '../../storage/repository'
import { BUTTON, CATEGORY_OPTIONS, FOCUS, Field, FieldSelect, SECONDARY } from '../fields'
import { CATEGORY_LABELS } from '../shelf-view'
import { readOrders } from './read-orders'
import {
  additionsFor,
  applyEdit,
  doneText,
  editorValues,
  estimate,
  estimateText,
  isAdded,
  matchFor,
  moveTo,
  rowsFromReply,
  shelfChoices,
  typicalLife,
  resetLife,
  type ReviewRow,
} from './review'

type Step = 'orders' | 'review' | 'done'
type Method = 'paste' | 'each'

const PRIMARY = `${BUTTON} border-accent bg-accent text-surface hover:opacity-90 data-disabled:opacity-50`

/** The import options, with the landing page's names. Only the first two work now. */
const OPTIONS: readonly { id: string; name: string; detail: string; now: boolean }[] = [
  {
    id: 'paste',
    name: 'Paste text or screenshots',
    detail: "From your shop's order page or app",
    now: true,
  },
  { id: 'each', name: 'Add each item', detail: 'Type items in one at a time', now: true },
  {
    id: 'camera',
    name: 'Scan with your camera',
    detail: 'Point at a receipt or a product barcode',
    now: false,
  },
  {
    id: 'upload',
    name: 'Upload an export',
    detail: 'CSV or PDF order history from the shop',
    now: false,
  },
  {
    id: 'email',
    name: 'Receipt emails',
    detail: 'Needs a Gmail or Outlook connection in Claude',
    now: false,
  },
  {
    id: 'browser',
    name: 'Claude opens the shop for me',
    detail: 'Needs a paid plan with browser control',
    now: false,
  },
]

const shelfText = (shelf: { category: keyof typeof CATEGORY_LABELS; group: string }) =>
  `${CATEGORY_LABELS[shelf.category]} › ${shelf.group}`

function dayText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function Steps({ step }: { step: Step }) {
  const steps: readonly [Step, string][] = [
    ['orders', 'Orders'],
    ['review', 'Review'],
    ['done', 'Done'],
  ]
  const at = steps.findIndex(([key]) => key === step)
  return (
    <ol aria-label="Steps" className="flex gap-2 text-sm">
      {steps.map(([key, label], index) => (
        <li
          key={key}
          aria-current={index === at ? 'step' : undefined}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${
            index === at
              ? 'border-accent font-semibold text-ink'
              : index < at
                ? 'border-line text-muted'
                : 'border-line text-muted'
          }`}
        >
          <span aria-hidden="true">{index < at ? '✓' : index + 1}</span>
          {label}
          {index < at && <span className="sr-only"> (done)</span>}
        </li>
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------------------------------
// Orders

function OrdersStep({
  onRead,
  onAddEach,
}: {
  onRead: (text: string) => void
  onAddEach: () => void
}) {
  const [method, setMethod] = useState<Method>('paste')
  const [text, setText] = useState('')

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted">
        Tell me how your orders get in, then add them. I&apos;ll put everything on the right shelf.
      </p>
      <RadioGroup
        value={method}
        onChange={(value) => setMethod(value as Method)}
        className="flex flex-col gap-2"
      >
        <Label className="font-display text-lg font-semibold">How Should Orders Get In?</Label>
        {OPTIONS.map((option) => (
          <Radio
            key={option.id}
            value={option.id}
            isDisabled={!option.now}
            className={({ isSelected, isDisabled }) =>
              `group flex min-h-[44px] cursor-default items-center gap-3 rounded-xl border p-3 ${FOCUS} ${
                isSelected ? 'border-accent bg-surface-2' : 'border-line bg-surface'
              } ${isDisabled ? 'text-muted' : ''}`
            }
          >
            {({ isSelected }) => (
              <>
                <span
                  aria-hidden="true"
                  className={`grid size-5 flex-none place-items-center rounded-full border-2 ${
                    isSelected ? 'border-accent' : 'border-edge'
                  }`}
                >
                  {isSelected && <span className="size-2.5 rounded-full bg-accent" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{option.name}</span>
                  <span className="text-sm text-muted">{option.detail}</span>
                </span>
                <span
                  className={`flex-none rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    option.now
                      ? 'border-eu bg-eu-20 text-sprout-deep'
                      : 'border-chip-line bg-chip-bg text-warn'
                  }`}
                >
                  {option.now ? 'Now' : 'Planned'}
                </span>
              </>
            )}
          </Radio>
        ))}
      </RadioGroup>

      {method === 'paste' ? (
        <section aria-labelledby="fill-orders-heading" className="flex flex-col gap-3">
          <h3 id="fill-orders-heading" className="font-display text-lg font-semibold">
            Your Orders
          </h3>
          <TextField value={text} onChange={setText} className="flex flex-col gap-1">
            <Label className="text-sm font-semibold">Order text</Label>
            <TextArea
              rows={6}
              maxLength={40000}
              placeholder="Paste order text here, from your shop's order page or app."
              className={`w-full rounded-xl border border-edge bg-surface p-3 text-base text-ink ${FOCUS}`}
            />
            <Text slot="description" className="text-sm text-muted">
              Screenshots are planned.
            </Text>
          </TextField>
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
            <p className="font-semibold">Nothing leaves your device yet.</p>
            <p className="text-muted">
              For now Shelfie reads example orders on this device. Later, reading an order will send
              its text to Claude, and only when you press Read my orders, each time. Shelfie keeps
              the items it finds, not the text.
            </p>
          </div>
          <Button
            isDisabled={text.trim() === ''}
            onPress={() => onRead(text)}
            className={`${PRIMARY} self-start`}
          >
            Read my orders
          </Button>
        </section>
      ) : (
        <Button onPress={onAddEach} className={`${PRIMARY} self-start`}>
          Add an item
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Review

type FocusTarget = 'name' | 'shelf'

function RowEditor({
  row,
  today,
  focus,
  onDone,
  onCancel,
}: {
  row: ReviewRow
  today: IsoDate
  focus: FocusTarget
  onDone: (row: ReviewRow) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<FormValues>(() => editorValues(row, today))
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, other: [] })
  const refs = {
    name: useRef<HTMLInputElement>(null),
    count: useRef<HTMLInputElement>(null),
    bought: useRef<HTMLInputElement>(null),
    days: useRef<HTMLInputElement>(null),
  }
  const shelfRef = useRef<HTMLButtonElement>(null)
  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }))

  useEffect(() => {
    if (focus === 'shelf') shelfRef.current?.focus()
    else refs.name.current?.focus()
    // Only when the editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const done = () => {
    const result = applyEdit(row, values, today)
    if (result.ok) {
      onDone(result.row)
      return
    }
    setErrors(result.errors)
    const first = (['name', 'count', 'bought', 'days'] as const).find(
      (field) => result.errors.fields[field] !== undefined,
    )
    if (first) refs[first].current?.focus()
  }

  // Escape closes this editor only, not the whole dialog.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <div
      role="group"
      aria-label={`Details of ${row.draft.name}`}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-3"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Name"
          value={values.name}
          onChange={(name) => set({ name })}
          error={errors.fields.name}
          inputRef={refs.name}
          maxLength={MAX_LENGTH.name}
        />
        <Field
          label="Brand"
          value={values.brand}
          onChange={(brand) => set({ brand })}
          maxLength={MAX_LENGTH.brand}
        />
        <Field
          label="Size"
          value={values.size}
          onChange={(size) => set({ size })}
          maxLength={MAX_LENGTH.size}
        />
        <Field
          label="Count"
          value={values.count}
          onChange={(count) => set({ count })}
          error={errors.fields.count}
          inputRef={refs.count}
          inputMode="numeric"
        />
        <Field
          label="Bought"
          type="date"
          value={values.bought}
          onChange={(bought) => set({ bought })}
          error={errors.fields.bought}
          inputRef={refs.bought}
        />
        <FieldSelect
          label="Shelf"
          value={values.category}
          options={CATEGORY_OPTIONS}
          buttonRef={shelfRef}
          onChange={(category) => set({ category, group: firstGroup(category) })}
        />
        <FieldSelect
          label="Group"
          value={values.group}
          options={groupOptions(values.category, row.draft.group).map((group) => ({
            id: group,
            label: group,
          }))}
          onChange={(group) => set({ group })}
        />
        <Field
          label="Days one lasts"
          value={values.days}
          onChange={(days) => set({ days })}
          error={errors.fields.days}
          inputRef={refs.days}
          inputMode="numeric"
          description={`Typical: about ${typicalLife(row)} days.`}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onPress={done} className={PRIMARY}>
          Done
        </Button>
        <Button onPress={onCancel} className={SECONDARY}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function ReviewRowView({
  row,
  items,
  today,
  editing,
  editButtonRef,
  onChange,
  onEdit,
  onCloseEditor,
}: {
  row: ReviewRow
  items: readonly Item[]
  today: IsoDate
  editing: FocusTarget | null
  editButtonRef: (key: string, el: HTMLButtonElement | null) => void
  onChange: (row: ReviewRow) => void
  onEdit: (focus: FocusTarget) => void
  onCloseEditor: () => void
}) {
  const { draft } = row
  const match = matchFor(row, items)
  const stock = estimate(row, today)
  const editorId = `editor-${row.key}`
  const added = isAdded(row)
  const unsure = draft.confidence !== 'high' || draft.alternatives.length > 0
  const choices = shelfChoices(row)
  const current = `${draft.category}|${draft.group}`
  const bits = [
    draft.brand,
    draft.size,
    `${draft.quantity} bought ${dayText(draft.boughtAt)}`,
    draft.shop,
  ].filter(Boolean)

  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border p-3 ${
        added ? 'border-line bg-surface' : 'border-dashed border-edge bg-surface'
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          isSelected={row.include}
          onChange={(include) => onChange({ ...row, include })}
          aria-label={`Add ${draft.name}`}
          className={`grid size-[44px] flex-none cursor-default place-items-center rounded-xl ${FOCUS}`}
        >
          {({ isSelected }) => (
            <span
              aria-hidden="true"
              className={`grid size-6 place-items-center rounded-md border-2 ${
                isSelected ? 'border-accent bg-accent text-surface' : 'border-edge bg-surface'
              }`}
            >
              {isSelected && (
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  className="fill-none stroke-current [stroke-width:2.4] [stroke-linecap:round] [stroke-linejoin:round]"
                >
                  <path d="M3 8.5l3.2 3L13 4.5" />
                </svg>
              )}
            </span>
          )}
        </Checkbox>
        <div className="flex min-w-0 flex-1 flex-col pt-1.5">
          <span className="font-semibold">{draft.name}</span>
          <span className="text-sm text-muted">{bits.join(' · ')}</span>
          <span className="text-sm text-muted">{estimateText(row, today)}</span>
          {match && (
            <span className="text-sm font-semibold text-sprout-deep">Tops up {match.name}</span>
          )}
        </div>
        <Button
          ref={(el) => editButtonRef(row.key, el)}
          aria-label={`Edit details of ${draft.name}`}
          aria-expanded={editing !== null}
          aria-controls={editing !== null ? editorId : undefined}
          onPress={() => (editing !== null ? onCloseEditor() : onEdit('name'))}
          className={`${SECONDARY} flex-none`}
        >
          Edit
        </Button>
      </div>

      {editing !== null && (
        <div id={editorId}>
          <RowEditor
            row={row}
            today={today}
            focus={editing}
            onDone={(next) => {
              onChange(next)
              onCloseEditor()
            }}
            onCancel={onCloseEditor}
          />
        </div>
      )}

      <div className="flex flex-col gap-2 pl-[56px]">
        {unsure ? (
          <RadioGroup
            value={current}
            onChange={(value) => {
              const shelf = choices.find((c) => `${c.category}|${c.group}` === value)
              if (shelf) onChange(moveTo(row, shelf))
            }}
            orientation="horizontal"
            className="flex flex-col gap-1.5"
          >
            <Label className="text-sm font-semibold">
              {draft.confidence === 'high' ? 'Which shelf?' : "Which shelf? I'm not sure."}
            </Label>
            {draft.reason && (
              <Text slot="description" className="text-sm text-muted">
                {draft.reason}
              </Text>
            )}
            <div className="flex flex-wrap gap-2">
              {choices.map((shelf) => (
                <Radio
                  key={`${shelf.category}|${shelf.group}`}
                  value={`${shelf.category}|${shelf.group}`}
                  className={({ isSelected }) =>
                    `inline-flex min-h-[44px] cursor-default items-center gap-1.5 rounded-full border px-3.5 text-sm ${FOCUS} ${
                      isSelected
                        ? 'border-2 border-sprout bg-eu-20 font-semibold text-sprout-deep'
                        : 'border-line bg-surface text-ink'
                    }`
                  }
                >
                  {({ isSelected }) => (
                    <>
                      {isSelected && <span aria-hidden="true">✓</span>}
                      {shelfText(shelf)}
                    </>
                  )}
                </Radio>
              ))}
              <Button
                onPress={() => onEdit('shelf')}
                aria-label={`Choose another shelf for ${draft.name}`}
                className={`inline-flex min-h-[44px] items-center rounded-full border border-dashed border-edge bg-surface px-3.5 text-sm text-ink hover:bg-surface-2 ${FOCUS}`}
              >
                + Other shelf
              </Button>
            </div>
          </RadioGroup>
        ) : (
          <p className="text-sm">
            <span className="text-muted">Shelf: </span>
            {shelfText(draft)}
          </p>
        )}

        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span>
            Lasts about {stock.lifeDays} days
            <span className="text-muted">
              {row.lifeOverride !== undefined ? ' · Edited by you' : ' · Typical estimate'}
            </span>
          </span>
          {row.lifeOverride !== undefined && (
            <Button
              onPress={() => onChange(resetLife(row))}
              aria-label={`Use typical estimate for ${draft.name}`}
              className={`inline-flex min-h-[44px] items-center font-semibold text-accent underline underline-offset-2 ${FOCUS}`}
            >
              Use typical
            </Button>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Checkbox
            isSelected={draft.mark === 'return'}
            onChange={(on) =>
              onChange({ ...row, draft: { ...draft, mark: on ? 'return' : 'mine' } })
            }
            aria-label={`Gift or return: ${draft.name}`}
            className={`group inline-flex min-h-[44px] cursor-default items-center gap-2 rounded-xl ${FOCUS}`}
          >
            {({ isSelected }) => (
              <>
                <span
                  aria-hidden="true"
                  className={`grid size-6 place-items-center rounded-md border-2 ${
                    isSelected ? 'border-ink bg-ink text-surface' : 'border-edge bg-surface'
                  }`}
                >
                  {isSelected && (
                    <svg
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      className="fill-none stroke-current [stroke-width:2.4] [stroke-linecap:round] [stroke-linejoin:round]"
                    >
                      <path d="M3 8.5l3.2 3L13 4.5" />
                    </svg>
                  )}
                </span>
                <span className="flex flex-col text-sm leading-tight">
                  <span className="font-semibold">Gift or return</span>
                  <span className="text-muted">Left out of your stock</span>
                </span>
              </>
            )}
          </Checkbox>
          <p
            className={`inline-flex items-center gap-1.5 text-sm font-semibold ${added ? 'text-sprout-deep' : 'text-warn'}`}
          >
            <span aria-hidden="true">{added ? '✓' : '–'}</span>
            {added
              ? 'Yours · will be added'
              : draft.mark === 'return'
                ? "Gift or return · won't be added"
                : "Not ticked · won't be added"}
          </p>
        </div>
      </div>
    </li>
  )
}

function ReviewStep({
  rows,
  items,
  today,
  saving,
  onRows,
  onAdd,
}: {
  rows: ReviewRow[]
  items: readonly Item[]
  today: IsoDate
  saving: boolean
  onRows: (rows: ReviewRow[]) => void
  onAdd: () => void
}) {
  // Only one editor is open at a time.
  const [editing, setEditing] = useState<{ key: string; focus: FocusTarget } | null>(null)
  const editButtons = useRef(new Map<string, HTMLButtonElement>())
  const returnFocusTo = useRef<string | null>(null)

  useEffect(() => {
    if (editing === null && returnFocusTo.current !== null) {
      editButtons.current.get(returnFocusTo.current)?.focus()
      returnFocusTo.current = null
    }
  }, [editing])

  const closeEditor = () => {
    returnFocusTo.current = editing?.key ?? null
    setEditing(null)
  }

  const adding = rows.filter(isAdded).length
  const unsure = rows.filter((row) => row.draft.confidence !== 'high').length

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        {unsure > 0
          ? `I'm sure about ${rows.length - unsure}. Please check ${unsure}.`
          : `Found ${rows.length} item${rows.length === 1 ? '' : 's'}.`}
      </p>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <ReviewRowView
            key={row.key}
            row={row}
            items={items}
            today={today}
            editing={editing?.key === row.key ? editing.focus : null}
            editButtonRef={(key, el) => {
              if (el) editButtons.current.set(key, el)
              else editButtons.current.delete(key)
            }}
            onChange={(next) => onRows(rows.map((r) => (r.key === next.key ? next : r)))}
            onEdit={(focus) => setEditing({ key: row.key, focus })}
            onCloseEditor={closeEditor}
          />
        ))}
      </ul>
      <Button
        isDisabled={adding === 0 || saving || editing !== null}
        onPress={onAdd}
        className={`${PRIMARY} self-start`}
      >
        {adding === 0 ? 'Nothing to add' : `Add ${adding} to my shelves`}
      </Button>
      {editing !== null && <p className="text-sm text-muted">Finish editing to add your items.</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The dialog

interface FillDialogProps {
  repository: ItemRepository
  items: readonly Item[]
  householdId: string
  today: IsoDate
  onClose: () => void
  /** "Add each item": close this and open the item editor to add one. */
  onAddEach: () => void
}

export function FillDialog({
  repository,
  items,
  householdId,
  today,
  onClose,
  onAddEach,
}: FillDialogProps) {
  const [step, setStep] = useState<Step>('orders')
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const stepHeading = useRef<HTMLHeadingElement>(null)

  // Move focus to the new step's heading, so keyboard and screen reader users start at the top.
  useEffect(() => {
    if (step !== 'orders') stepHeading.current?.focus()
  }, [step])

  const read = async (text: string) => {
    setError('')
    try {
      const found = rowsFromReply(await readOrders(text), today)
      if (found.length === 0) {
        setError("I couldn't find any items in that text.")
        return
      }
      setRows(found)
      setStep('review')
    } catch (cause) {
      console.error('Shelfie: could not read the orders', cause)
      setError("Couldn't read that. Try again.")
    }
  }

  const add = async () => {
    setSaving(true)
    const { additions, skipped } = additionsFor(rows, items, householdId, today, {
      item: () => crypto.randomUUID(),
      purchase: () => crypto.randomUUID(),
    })
    let added = 0
    let toppedUp = 0
    for (const addition of additions) {
      try {
        await repository.putWithPurchase(addition.item, addition.purchase)
        added += 1
        if (addition.topsUp !== undefined) toppedUp += 1
      } catch (cause) {
        console.error('Shelfie: could not add an item', cause)
      }
    }
    const notAdded = additions.length - added + skipped.length
    const leftOut = rows.filter((row) => !isAdded(row)).length
    setDone(
      doneText(added, toppedUp, leftOut) +
        (notAdded > 0 ? ` ${notAdded} couldn't be added; try those again.` : ''),
    )
    setSaving(false)
    setStep('done')
  }

  const title =
    step === 'review' ? `Review ${rows.length} Item${rows.length === 1 ? '' : 's'}` : 'All Done'

  return (
    <ModalOverlay
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      isDismissable
      className="fixed inset-0 z-20 overflow-y-auto bg-bg/80 p-0 md:p-6"
    >
      <Modal className="mx-auto min-h-full w-full max-w-2xl border-line bg-surface p-4 md:min-h-0 md:rounded-3xl md:border md:p-6">
        <Dialog className="flex flex-col gap-4 outline-none">
          <div className="flex items-center gap-3">
            <Heading slot="title" className="font-display text-2xl font-semibold">
              Fill my shelves
            </Heading>
            <Button
              onPress={onClose}
              aria-label="Close Fill my shelves"
              className={`ml-auto grid size-[44px] place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink ${FOCUS}`}
            >
              <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                aria-hidden="true"
                className="fill-none stroke-current [stroke-width:2] [stroke-linecap:round]"
              >
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </Button>
          </div>
          <Steps step={step} />
          {step !== 'orders' && (
            <h3
              ref={stepHeading}
              tabIndex={-1}
              className="font-display text-xl font-semibold outline-none"
            >
              {title}
            </h3>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          {step === 'orders' && (
            <OrdersStep onRead={(text) => void read(text)} onAddEach={onAddEach} />
          )}
          {step === 'review' && (
            <ReviewStep
              rows={rows}
              items={items}
              today={today}
              saving={saving}
              onRows={setRows}
              onAdd={() => void add()}
            />
          )}
          {step === 'done' && (
            <div className="flex flex-col gap-4">
              <p role="status" className="text-lg">
                {done}
              </p>
              <Button onPress={onClose} className={`${PRIMARY} self-start`}>
                See my shelves
              </Button>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

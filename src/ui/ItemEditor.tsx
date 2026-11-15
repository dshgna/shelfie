// The item editor: a modal dialog to add an item (with its first purchase) or edit one. Its rules
// live in item-form.ts; this file only draws the form and saves through ItemRepository.
// React Aria's Modal moves focus into the dialog, keeps it there, closes on Escape and returns
// focus to whatever opened it.

import { useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  Button,
  Dialog,
  FieldError,
  Form,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  Select,
  SelectValue,
  Text,
  TextField,
  type Key,
} from 'react-aria-components'
import type { IsoDate } from '../domain/dates'
import { CATEGORIES, type Category, type Group, type Item } from '../domain/item'
import type { ItemRepository } from '../storage/repository'
import {
  MAX_LENGTH,
  buildEdit,
  buildNew,
  firstGroup,
  groupOptions,
  newValues,
  typicalDays,
  valuesFromItem,
  type EditResult,
  type FormErrors,
  type FormField,
  type FormValues,
  type NewResult,
} from './item-form'
import { CATEGORY_LABELS } from './shelf-view'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const INPUT = `min-h-[44px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink data-invalid:border-danger ${FOCUS}`
const BUTTON = `inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 font-semibold ${FOCUS}`
const SECONDARY = `${BUTTON} border-edge bg-surface text-ink hover:bg-surface-2`
const DANGER = `${BUTTON} border-danger bg-surface text-danger hover:bg-surface-2`

const OVERLAY = 'fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-bg/80 p-4'
const PANEL = 'w-full rounded-3xl border border-line bg-surface p-5 md:p-6'

export type EditorTarget =
  | { kind: 'edit'; item: Item }
  | {
      kind: 'add'
      householdId: string
      /** Start on this shelf and group, as "Add a product" on a routine step does. */
      category?: Category
      group?: Group
    }

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  description?: ReactNode
  inputRef?: RefObject<HTMLInputElement | null>
  type?: 'text' | 'date'
  inputMode?: 'numeric'
  maxLength?: number
  autoFocus?: boolean
}

function Field({
  label,
  value,
  onChange,
  error,
  description,
  inputRef,
  type,
  inputMode,
  maxLength,
  autoFocus,
}: FieldProps) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      isInvalid={error !== undefined}
      validationBehavior="aria"
      className="flex flex-col gap-1"
    >
      <Label className="text-sm font-semibold">{label}</Label>
      <Input
        ref={inputRef}
        type={type ?? 'text'}
        inputMode={inputMode}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoComplete="off"
        className={INPUT}
      />
      {description && (
        <Text slot="description" className="text-sm text-muted">
          {description}
        </Text>
      )}
      <FieldError className="text-sm font-semibold text-danger">{error}</FieldError>
    </TextField>
  )
}

function FieldSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <Select
      value={value}
      onChange={(key: Key | null) => {
        if (key !== null) onChange(String(key) as T)
      }}
      className="flex flex-col gap-1"
    >
      <Label className="text-sm font-semibold">{label}</Label>
      <Button className={`${INPUT} flex items-center justify-between gap-2 text-left`}>
        <SelectValue className="truncate" />
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
          className="flex-none fill-none stroke-current [stroke-width:1.8] [stroke-linecap:round]"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </Button>
      <Popover className="min-w-(--trigger-width) rounded-xl border border-line bg-surface p-1 shadow-lg">
        <ListBox items={options} className="max-h-72 overflow-auto outline-none">
          {(option) => (
            <ListBoxItem
              id={option.id}
              className="flex min-h-[44px] cursor-default items-center rounded-lg px-3 outline-none data-focused:bg-surface-2 data-selected:font-semibold"
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  )
}

const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({
  id: category,
  label: CATEGORY_LABELS[category],
}))

function ConfirmDelete({
  name,
  isOpen,
  onOpenChange,
  onConfirm,
}: {
  name: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className={OVERLAY}>
      <Modal className={`${PANEL} max-w-sm`}>
        <Dialog role="alertdialog" className="flex flex-col gap-3 outline-none">
          {({ close }) => (
            <>
              <Heading slot="title" className="font-display text-xl font-semibold">
                Delete {name || 'this item'}?
              </Heading>
              <p className="text-muted">It comes off your shelves and the shopping list.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button autoFocus onPress={close} className={SECONDARY}>
                  Keep it
                </Button>
                <Button
                  onPress={onConfirm}
                  className={`${BUTTON} border-danger bg-danger text-surface hover:opacity-90`}
                >
                  Delete
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

interface ItemEditorProps {
  target: EditorTarget
  repository: ItemRepository
  today: IsoDate
  /** Called when the dialog closes; `savedId` is the item's id when it was just saved. */
  onClose: (savedId?: string) => void
}

/** Rendered only while open: mounting opens it, and unmounting returns focus to the trigger. */
export function ItemEditor({ target, repository, today, onClose }: ItemEditorProps) {
  const editing = target.kind === 'edit' ? target.item : undefined
  const [values, setValues] = useState<FormValues>(() =>
    editing
      ? valuesFromItem(editing)
      : target.kind === 'add' && target.category !== undefined
        ? {
            ...newValues(target.category),
            ...(target.group !== undefined ? { group: target.group } : {}),
          }
        : newValues(),
  )
  const [errors, setErrors] = useState<FormErrors>({ fields: {}, other: [] })
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const refs: Record<FormField, RefObject<HTMLInputElement | null>> = {
    name: useRef<HTMLInputElement>(null),
    count: useRef<HTMLInputElement>(null),
    bought: useRef<HTMLInputElement>(null),
    days: useRef<HTMLInputElement>(null),
  }

  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }))
  const typical = typicalDays(values, editing?.unit)
  const blankIsTypical = !editing || editing.reorder.kind === 'share'

  const save = async () => {
    const result: EditResult | NewResult = editing
      ? buildEdit(editing, values, today)
      : buildNew(
          values,
          { itemId: crypto.randomUUID(), purchaseId: crypto.randomUUID() },
          target.kind === 'add' ? target.householdId : '',
          today,
        )
    if (!result.ok) {
      setErrors(result.errors)
      const first = (['name', 'count', 'bought', 'days'] as const).find(
        (field) => result.errors.fields[field] !== undefined,
      )
      if (first) refs[first].current?.focus()
      return
    }
    setErrors({ fields: {}, other: [] })
    setSaving(true)
    try {
      if (result.purchase) await repository.putWithPurchase(result.item, result.purchase)
      else await repository.put(result.item)
      onClose(result.item.id)
    } catch (error) {
      console.error('Shelfie: could not save the item', error)
      setErrors({ fields: {}, other: ["Couldn't save. Try again."] })
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!editing) return
    try {
      await repository.remove(editing.id)
      setConfirming(false)
      onClose()
    } catch (error) {
      console.error('Shelfie: could not delete the item', error)
      setConfirming(false)
      setErrors({ fields: {}, other: ["Couldn't delete. Try again."] })
    }
  }

  return (
    <ModalOverlay
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      isDismissable
      className={OVERLAY}
    >
      <Modal className={`${PANEL} max-w-xl`}>
        <Dialog className="outline-none">
          <Form
            validationBehavior="aria"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
            className="flex flex-col gap-4"
          >
            <Heading slot="title" className="font-display text-2xl font-semibold">
              {editing ? 'Edit Item' : 'Add Item'}
            </Heading>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field
                  label="Name"
                  value={values.name}
                  onChange={(name) => set({ name })}
                  error={errors.fields.name}
                  inputRef={refs.name}
                  maxLength={MAX_LENGTH.name}
                  autoFocus
                />
              </div>
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
                label={editing ? 'In stock' : 'Count'}
                value={values.count}
                onChange={(count) => set({ count })}
                error={errors.fields.count}
                inputRef={refs.count}
                inputMode="numeric"
              />
              {!editing && (
                <Field
                  label="Bought"
                  type="date"
                  value={values.bought}
                  onChange={(bought) => set({ bought })}
                  error={errors.fields.bought}
                  inputRef={refs.bought}
                  description="Leave blank for today."
                />
              )}
              <FieldSelect
                label="Shelf"
                value={values.category}
                options={CATEGORY_OPTIONS}
                onChange={(category: Category) => set({ category, group: firstGroup(category) })}
              />
              <FieldSelect
                label="Group"
                value={values.group}
                options={groupOptions(values.category, editing?.group).map((group) => ({
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
                description={
                  blankIsTypical
                    ? `Leave blank for the typical estimate: about ${typical} days.`
                    : 'Optional.'
                }
              />
            </div>
            {errors.other.length > 0 && (
              <div role="alert" className="text-sm font-semibold text-danger">
                {errors.other.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                isDisabled={saving}
                className={`${BUTTON} border-accent bg-accent text-surface hover:opacity-90`}
              >
                Save item
              </Button>
              <Button onPress={() => onClose()} className={SECONDARY}>
                Cancel
              </Button>
              {editing && (
                <Button onPress={() => setConfirming(true)} className={`${DANGER} ml-auto`}>
                  Delete
                </Button>
              )}
            </div>
          </Form>
          {editing && (
            <ConfirmDelete
              name={editing.name}
              isOpen={confirming}
              onOpenChange={setConfirming}
              onConfirm={() => void remove()}
            />
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

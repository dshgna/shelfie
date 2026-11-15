// The item editor: a modal dialog to add an item (with its first purchase) or edit one. Its rules
// live in item-form.ts; this file only draws the form and saves through ItemRepository.
// React Aria's Modal moves focus into the dialog, keeps it there, closes on Escape and returns
// focus to whatever opened it.

import { useRef, useState, type RefObject } from 'react'
import { Button, Dialog, Form, Heading, Modal, ModalOverlay } from 'react-aria-components'
import type { IsoDate } from '../domain/dates'
import type { Category, Group, Item } from '../domain/item'
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
import { BUTTON, CATEGORY_OPTIONS, DANGER, Field, FieldSelect, SECONDARY } from './fields'

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

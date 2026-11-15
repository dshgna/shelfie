import { expect, test } from '@playwright/test'

// The item editor, on the app's invented example items.

test('opens from a row, focuses Name, and Escape returns focus to the row', async ({ page }) => {
  await page.goto('/')
  const open = page.getByRole('button', { name: 'Open Gel Cleanser to edit' })
  await open.click()
  const dialog = page.getByRole('dialog', { name: 'Edit Item' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(open).toBeFocused()
})

test('shows short messages next to the fields and focuses the first one', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Gel Cleanser to edit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Item' })
  await dialog.getByRole('textbox', { name: 'Name' }).fill('   ')
  await dialog.getByRole('textbox', { name: 'In stock' }).fill('2.5')
  await dialog.getByRole('button', { name: 'Save item' }).click()
  await expect(dialog.getByText('Enter a name for the item.')).toBeVisible()
  await expect(dialog.getByText('This must be a whole number, 0 or more.')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeFocused()
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})

test('saves changes to the item', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Gel Cleanser to edit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Item' })
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Gentle Gel Cleanser')
  await dialog.getByRole('textbox', { name: 'In stock' }).fill('5')
  await dialog.getByRole('button', { name: 'Save item' }).click()
  await expect(dialog).toBeHidden()
  const row = page.getByRole('listitem').filter({
    has: page.getByRole('button', { name: 'Open Gentle Gel Cleanser to edit' }),
  })
  await expect(row.getByText('5 left')).toBeVisible()
})

test('asks before deleting, inside the page, and Keep it keeps the item', async ({ page }) => {
  let nativeDialog = false
  page.on('dialog', async (d) => {
    nativeDialog = true
    await d.dismiss()
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Dish Soap to edit' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit Item' })
  await editor.getByRole('button', { name: 'Delete' }).click()

  const confirm = page.getByRole('alertdialog', { name: 'Delete Dish Soap?' })
  await expect(confirm).toBeVisible()
  await expect(confirm.getByRole('button', { name: 'Keep it' })).toBeFocused()
  await confirm.getByRole('button', { name: 'Keep it' }).click()
  await expect(confirm).toBeHidden()
  await expect(editor).toBeVisible()

  await editor.getByRole('button', { name: 'Delete' }).click()
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open Dish Soap to edit' })).toHaveCount(0)
  expect(nativeDialog, 'window.confirm or alert was used').toBe(false)
})

test('changes the shelf and resets the group to that shelf’s first one', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Dish Soap to edit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Item' })
  await dialog.getByRole('button', { name: /Shelf/ }).click()
  await page.getByRole('option', { name: 'Laundry' }).click()
  await expect(dialog.getByRole('button', { name: /Group/ })).toContainText('Washing')
})

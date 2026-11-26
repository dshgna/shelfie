import type { Locator, Page } from '@playwright/test'
import { expect, test } from './guard'
import { FAKE_SUPABASE_ORIGIN, openSignedIn } from './fake-supabase'

// The main flows end to end, on the app's invented example items and the mock order reader's
// invented rows. Every test here fails on a request to another origin or a CSP violation (guard.ts).

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })
// The fake Supabase project is answered in the browser (e2e/fake-supabase.ts), never reached.
test.use({ allowedOrigins: [FAKE_SUPABASE_ORIGIN] })

const row = (page: Page, name: string): Locator =>
  page.getByRole('listitem').filter({
    has: page.getByRole('button', { name: `Open ${name} to edit` }),
  })

const reviewRow = (dialog: Locator, name: string): Locator =>
  dialog
    .locator('li')
    .filter({ has: dialog.page().getByRole('button', { name: `Edit details of ${name}` }) })

async function openReview(page: Page): Promise<Locator> {
  await openSignedIn(page)
  await page.getByRole('button', { name: 'Fill my shelves' }).click()
  const dialog = page.getByRole('dialog', { name: 'Fill my shelves' })
  await dialog.getByRole('textbox', { name: 'Order text' }).fill('Invented order: 2 things')
  await dialog.getByRole('button', { name: 'Read my orders' }).click()
  await expect(dialog.getByRole('heading', { name: 'Review 5 Items' })).toBeVisible()
  return dialog
}

test('adds a new item through the item editor', async ({ page }) => {
  await openSignedIn(page)
  await page.getByRole('button', { name: 'Fill my shelves' }).click()
  const fill = page.getByRole('dialog', { name: 'Fill my shelves' })
  await fill.getByText('Add each item', { exact: true }).click()
  await fill.getByRole('button', { name: 'Add an item' }).click()

  const editor = page.getByRole('dialog', { name: 'Add Item' })
  await expect(editor.getByRole('textbox', { name: 'Name' })).toBeFocused()
  await editor.getByRole('textbox', { name: 'Name' }).fill('Bamboo Toothbrush')
  await editor.getByRole('textbox', { name: 'Brand' }).fill('Pinecrest')
  await editor.getByRole('textbox', { name: 'Count' }).fill('4')
  await editor.getByRole('button', { name: /Shelf/ }).click()
  await page.getByRole('option', { name: 'Dental' }).click()
  await editor.getByRole('button', { name: 'Save item' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const open = page.getByRole('button', { name: 'Open Bamboo Toothbrush to edit' })
  await expect(open).toBeVisible()
  await expect(row(page, 'Bamboo Toothbrush').locator('[aria-live]')).toHaveText('4 left')
  await expect(row(page, 'Bamboo Toothbrush')).toContainText('Pinecrest')

  // It was saved as typed: the editor reopens with the same values.
  await open.click()
  const saved = page.getByRole('dialog', { name: 'Edit Item' })
  await expect(saved.getByRole('textbox', { name: 'Name' })).toHaveValue('Bamboo Toothbrush')
  await expect(saved.getByRole('textbox', { name: 'In stock' })).toHaveValue('4')
  await expect(saved.getByRole('button', { name: /Shelf/ })).toContainText('Dental')
})

test('plus and minus change the count and the stock bar', async ({ page }) => {
  await openSignedIn(page)
  // Kitchen Sponges: 0 left, so its bar follows the count.
  const sponges = row(page, 'Kitchen Sponges')
  const count = sponges.locator('[aria-live]')
  const meter = page.getByRole('meter', { name: 'Kitchen Sponges stock' })
  const fillBar = meter.locator('div > div')
  await expect(count).toHaveText('0 left')
  await expect(meter).toHaveAttribute('aria-valuenow', '0')
  await expect(fillBar).toHaveAttribute('style', /width: 0%/)

  await page.getByRole('button', { name: 'Add one Kitchen Sponges' }).click()
  await expect(count).toHaveText('1 left')
  await expect(meter).not.toHaveAttribute('aria-valuenow', '0')
  const one = Number(await meter.getAttribute('aria-valuenow'))
  expect(one).toBeGreaterThan(0)
  await expect(meter).toHaveAttribute('aria-valuetext', `${one}% left`)
  await expect(fillBar).toHaveAttribute('style', new RegExp(`width: ${one}%`))

  await page.getByRole('button', { name: 'Add one Kitchen Sponges' }).click()
  await expect(count).toHaveText('2 left')
  await expect
    .poll(async () => Number(await meter.getAttribute('aria-valuenow')))
    .toBeGreaterThan(one)

  await page.getByRole('button', { name: 'Remove one Kitchen Sponges' }).click()
  await page.getByRole('button', { name: 'Remove one Kitchen Sponges' }).click()
  await expect(count).toHaveText('0 left')
  await expect(meter).toHaveAttribute('aria-valuenow', '0')
  await expect(fillBar).toHaveAttribute('style', /width: 0%/)
})

test('builds the shopping list from low stock and copies it', async ({ page }) => {
  await openSignedIn(page)
  const shopping = page.getByRole('tab', { name: /Shopping/ })
  await shopping.click()
  const panel = page.getByRole('tabpanel', { name: /Shopping/ })
  await expect(panel.getByRole('checkbox', { name: /Mint Toothpaste/ })).toHaveCount(0)

  // Mint Toothpaste: 3 tubes, reorder at 1 left. Two fewer puts it on the list.
  await page.getByRole('tab', { name: /Inventory/ }).click()
  await page.getByRole('button', { name: 'Remove one Mint Toothpaste' }).click()
  await page.getByRole('button', { name: 'Remove one Mint Toothpaste' }).click()
  await expect(row(page, 'Mint Toothpaste').locator('[aria-live]')).toHaveText('1 left')

  await shopping.click()
  await expect(panel.getByRole('checkbox', { name: /Mint Toothpaste/ })).toBeAttached()
  await expect(panel.getByRole('checkbox', { name: /Oat Shampoo/ })).toBeAttached()

  await panel.getByRole('button', { name: 'Copy list' }).click()
  await expect(panel.getByRole('status')).toHaveText('Shopping list copied')
  const lines = (await page.evaluate(() => navigator.clipboard.readText())).split('\n')
  expect(lines[0]).toBe('Shopping list')
  expect(lines).toContain('- Oat Shampoo x1 (bottle)')
  expect(lines.some((line) => /^- Mint Toothpaste x\d+ \(tubes?\)$/.test(line))).toBe(true)
  expect(lines.slice(1).every((line) => line.startsWith('- '))).toBe(true)
})

test('Fill my shelves: review, edit one row, mark a gift, add, and see the Done count', async ({
  page,
}) => {
  const dialog = await openReview(page)

  // Open one Edit and change a field.
  const edit = dialog.getByRole('button', { name: 'Edit details of Rice Water Toner' })
  await edit.click()
  const editor = dialog.getByRole('group', { name: 'Details of Rice Water Toner' })
  await editor.getByRole('textbox', { name: 'Count' }).fill('3')
  await editor.getByRole('button', { name: 'Done' }).click()
  await expect(editor).toHaveCount(0)
  await expect(edit).toBeFocused()
  await expect(reviewRow(dialog, 'Rice Water Toner')).toContainText('3 bought')

  // Toggle Gift or return on, off, then on again for one row.
  const add = dialog.getByRole('button', { name: /to my shelves/ })
  const lemon = reviewRow(dialog, 'Lemon Washing-Up Liquid')
  await expect(add).toHaveText('Add 4 to my shelves')
  await lemon.getByText('Gift or return', { exact: true }).click()
  await expect(lemon).toContainText("Gift or return · won't be added")
  await expect(add).toHaveText('Add 3 to my shelves')
  await lemon.getByText('Gift or return', { exact: true }).click()
  await expect(lemon).toContainText('Yours · will be added')
  await expect(add).toHaveText('Add 4 to my shelves')
  await lemon.getByText('Gift or return', { exact: true }).click()
  await expect(add).toHaveText('Add 3 to my shelves')

  await add.click()
  await expect(dialog.getByRole('heading', { name: 'All Done' })).toBeFocused()
  await expect(
    dialog.getByRole('list', { name: 'Steps' }).getByRole('listitem').last(),
  ).toHaveAttribute('aria-current', 'step')
  // Rice Water Toner and Gentle Gel Wash are new, Oat Shampoo is topped up, and Lemon
  // Washing-Up Liquid and Lavender Bath Salts are left out.
  await expect(dialog.getByRole('status')).toHaveText(
    '2 new items added to your shelves. 1 item you already had topped up. 2 left out as gifts, returns or unticked.',
  )

  await dialog.getByRole('button', { name: 'See my shelves' }).click()
  await expect(dialog).toBeHidden()
  await expect(row(page, 'Rice Water Toner').locator('[aria-live]')).toHaveText('3 left')
  await expect(page.getByRole('button', { name: 'Open Gentle Gel Wash to edit' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Open Lemon Washing-Up Liquid to edit' }),
  ).toHaveCount(0)
})

test('exactly one Edit button per review row', async ({ page }) => {
  const dialog = await openReview(page)
  const rows = dialog
    .locator('li')
    .filter({ has: page.getByRole('button', { name: /^Edit details of/ }) })
  const edits = dialog.getByRole('button', { name: /^Edit\b/ })

  await expect(rows).toHaveCount(5)
  await expect(edits).toHaveCount(5)
  for (const r of await rows.all()) {
    await expect(r.getByRole('button', { name: /^Edit\b/ })).toHaveCount(1)
  }

  // Opening a row's editor doesn't add or remove an Edit button anywhere.
  await dialog.getByRole('button', { name: 'Edit details of Oat Shampoo' }).click()
  await expect(dialog.getByRole('group', { name: 'Details of Oat Shampoo' })).toBeVisible()
  await expect(edits).toHaveCount(5)
  for (const r of await rows.all()) {
    await expect(r.getByRole('button', { name: /^Edit\b/ })).toHaveCount(1)
  }
})

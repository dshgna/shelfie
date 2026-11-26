import { expect, test, type Locator, type Page } from '@playwright/test'
import { FAKE_SUPABASE_ORIGIN, openSignedIn } from './fake-supabase'

// Fill my shelves, with the mock reader's invented rows: Oat Shampoo (tops up the example item),
// Rice Water Toner, Gentle Gel Wash (unsure shelf), Lemon Washing-Up Liquid and Lavender Bath
// Salts (returned).

async function openFill(page: Page): Promise<Locator> {
  await openSignedIn(page)
  await page.getByRole('button', { name: 'Fill my shelves' }).click()
  return page.getByRole('dialog', { name: 'Fill my shelves' })
}

async function openReview(page: Page): Promise<Locator> {
  const dialog = await openFill(page)
  await dialog.getByRole('textbox', { name: 'Order text' }).fill('Invented order text')
  await dialog.getByRole('button', { name: 'Read my orders' }).click()
  await expect(dialog.getByRole('heading', { name: 'Review 5 Items' })).toBeVisible()
  return dialog
}

const row = (dialog: Locator, name: string) =>
  dialog
    .locator('li')
    .filter({ has: dialog.page().getByRole('button', { name: `Edit details of ${name}` }) })

const focusedLabel = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement | null
    return el?.getAttribute('aria-label') ?? el?.labels?.[0]?.textContent ?? el?.textContent
  })

test('Orders lists the import options with Now or Planned, never Coming soon', async ({ page }) => {
  const dialog = await openFill(page)
  const options = dialog.getByRole('radiogroup', { name: 'How Should Orders Get In?' })
  for (const name of ['Paste text or screenshots', 'Add each item']) {
    const option = options.locator('label').filter({ hasText: name })
    await expect(option).toContainText('Now')
    await expect(option.getByRole('radio')).toBeEnabled()
  }
  for (const name of [
    'Scan with your camera',
    'Upload an export',
    'Receipt emails',
    'Claude opens the shop for me',
  ]) {
    const option = options.locator('label').filter({ hasText: name })
    await expect(option).toContainText('Planned')
    await expect(option.getByRole('radio')).toBeDisabled()
  }
  await expect(dialog.getByText(/coming soon/i)).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: 'Your Orders' })).toBeVisible()
})

test('says plainly that sending to AI will be a per-use action, and nothing leaves yet', async ({
  page,
}) => {
  const dialog = await openFill(page)
  await expect(dialog.getByText('Nothing leaves your device yet.')).toBeVisible()
  await expect(dialog.getByText(/only when you press Read my orders, each time/)).toBeVisible()
  const read = dialog.getByRole('button', { name: 'Read my orders' })
  await expect(read).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Order text' }).fill('Invented order text')
  await expect(read).toBeEnabled()
})

test('each review row has one Edit button, and only one editor opens at a time', async ({
  page,
}) => {
  const dialog = await openReview(page)
  const rows = dialog
    .locator('li')
    .filter({ has: dialog.page().getByRole('button', { name: /^Edit details of/ }) })
  await expect(rows).toHaveCount(5)
  for (const r of await rows.all()) {
    await expect(r.getByRole('button', { name: /^Edit/ })).toHaveCount(1)
  }

  await dialog.getByRole('button', { name: 'Edit details of Rice Water Toner' }).click()
  await expect(dialog.getByRole('group', { name: 'Details of Rice Water Toner' })).toBeVisible()
  expect(await focusedLabel(page)).toBe('Name')
  await expect(
    dialog.getByRole('button', { name: 'Edit details of Rice Water Toner' }),
  ).toHaveAttribute('aria-expanded', 'true')

  await dialog.getByRole('button', { name: 'Edit details of Oat Shampoo' }).click()
  await expect(dialog.getByRole('group', { name: /^Details of/ })).toHaveCount(1)
  await expect(dialog.getByRole('group', { name: 'Details of Oat Shampoo' })).toBeVisible()
})

test('Escape closes only the row editor and returns focus to its Edit button', async ({ page }) => {
  const dialog = await openReview(page)
  const edit = dialog.getByRole('button', { name: 'Edit details of Oat Shampoo' })
  await edit.click()
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('group', { name: /^Details of/ })).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await expect(edit).toBeFocused()
})

test('the editor has the eight fields, checks them, and Done returns focus', async ({ page }) => {
  const dialog = await openReview(page)
  const edit = dialog.getByRole('button', { name: 'Edit details of Lemon Washing-Up Liquid' })
  await edit.click()
  const editor = dialog.getByRole('group', { name: 'Details of Lemon Washing-Up Liquid' })
  for (const name of ['Name', 'Brand', 'Size', 'Count', 'Bought', 'Days one lasts']) {
    await expect(editor.getByRole('textbox', { name })).toBeVisible()
  }
  await expect(editor.getByRole('button', { name: /Shelf/ })).toBeVisible()
  await expect(editor.getByRole('button', { name: /Group/ })).toBeVisible()

  await editor.getByRole('textbox', { name: 'Count' }).fill('0')
  await editor.getByRole('button', { name: 'Done' }).click()
  await expect(editor.getByText('This must be a whole number, 1 or more.')).toBeVisible()
  expect(await focusedLabel(page)).toBe('Count')

  await editor.getByRole('textbox', { name: 'Count' }).fill('4')
  await editor.getByRole('button', { name: 'Done' }).click()
  await expect(editor).toHaveCount(0)
  await expect(edit).toBeFocused()
  await expect(row(dialog, 'Lemon Washing-Up Liquid')).toContainText('4 bought')
})

test('+ Other shelf opens the editor on Shelf; shelf chips move the row', async ({ page }) => {
  const dialog = await openReview(page)
  const gel = row(dialog, 'Gentle Gel Wash')
  await expect(gel.getByText("Which shelf? I'm not sure.")).toBeVisible()
  await expect(gel.getByRole('radio')).toHaveCount(2)

  await gel.getByText('Body & Bath › Body Soap').click()
  await expect(gel.getByRole('radio', { name: /Body & Bath/ })).toBeChecked()
  await expect(gel.getByRole('radio')).toHaveCount(2)

  await gel.getByRole('button', { name: 'Choose another shelf for Gentle Gel Wash' }).click()
  await expect(dialog.getByRole('group', { name: 'Details of Gentle Gel Wash' })).toBeVisible()
  await expect(
    dialog
      .getByRole('group', { name: 'Details of Gentle Gel Wash' })
      .getByRole('button', { name: /Shelf/ }),
  ).toBeFocused()
})

test('Use typical shows only after the estimate is edited, and puts it back', async ({ page }) => {
  const dialog = await openReview(page)
  const toner = row(dialog, 'Rice Water Toner')
  await expect(toner.getByText(/Typical estimate/)).toBeVisible()
  await expect(toner.getByRole('button', { name: /Use typical/ })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Edit details of Rice Water Toner' }).click()
  const editor = dialog.getByRole('group', { name: 'Details of Rice Water Toner' })
  await editor.getByRole('textbox', { name: 'Days one lasts' }).fill('120')
  await editor.getByRole('button', { name: 'Done' }).click()
  await expect(toner.getByText('Lasts about 120 days')).toBeVisible()
  await expect(toner.getByText(/Edited by you/)).toBeVisible()

  await toner.getByRole('button', { name: 'Use typical estimate for Rice Water Toner' }).click()
  await expect(toner.getByText(/Typical estimate/)).toBeVisible()
  await expect(toner.getByRole('button', { name: /Use typical/ })).toHaveCount(0)
})

test('Mine, Gift or return and unticked are each said in words', async ({ page }) => {
  const dialog = await openReview(page)
  const add = dialog.getByRole('button', { name: /to my shelves/ })
  await expect(row(dialog, 'Lavender Bath Salts')).toContainText("Gift or return · won't be added")
  await expect(row(dialog, 'Rice Water Toner')).toContainText('Yours · will be added')
  await expect(add).toHaveText('Add 4 to my shelves')

  const toner = row(dialog, 'Rice Water Toner')
  await toner.getByText('Gift or return', { exact: true }).click()
  await expect(toner).toContainText("Gift or return · won't be added")
  await expect(add).toHaveText('Add 3 to my shelves')

  await toner.getByText('Gift or return', { exact: true }).click()
  await toner.getByRole('checkbox', { name: 'Add Rice Water Toner' }).uncheck({ force: true })
  await expect(toner).toContainText("Not ticked · won't be added")
  await expect(add).toHaveText('Add 3 to my shelves')
})

test('adding tops up a match, adds new items and says what happened', async ({ page }) => {
  const dialog = await openReview(page)
  await expect(row(dialog, 'Oat Shampoo')).toContainText('Tops up Oat Shampoo')
  await dialog.getByRole('button', { name: 'Add 4 to my shelves' }).click()
  await expect(dialog.getByRole('heading', { name: 'All Done' })).toBeFocused()
  await expect(dialog.getByRole('status')).toHaveText(
    '3 new items added to your shelves. 1 item you already had topped up. 1 left out as a gift, a return or unticked.',
  )

  const open = page.getByRole('button', { name: 'Fill my shelves' })
  await dialog.getByRole('button', { name: 'See my shelves' }).click()
  await expect(dialog).toBeHidden()
  await expect(open).toBeFocused()

  const shampoo = page
    .locator('li')
    .filter({ has: page.getByRole('button', { name: 'Open Oat Shampoo to edit' }) })
  await expect(shampoo.locator('[aria-live]')).toHaveText('2 left')
  for (const name of ['Rice Water Toner', 'Gentle Gel Wash', 'Lemon Washing-Up Liquid']) {
    await expect(page.getByRole('button', { name: `Open ${name} to edit` })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Open Lavender Bath Salts to edit' })).toHaveCount(
    0,
  )
})

test('closing the dialog discards the review', async ({ page }) => {
  const dialog = await openReview(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Fill my shelves' }).click()
  await expect(dialog.getByRole('textbox', { name: 'Order text' })).toHaveValue('')
  await expect(dialog.getByRole('button', { name: /^Edit details of/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open Rice Water Toner to edit' })).toHaveCount(0)
})

test('Add each item opens the item editor', async ({ page }) => {
  const dialog = await openFill(page)
  await dialog.getByText('Add each item', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Add an item' }).click()
  await expect(page.getByRole('dialog', { name: 'Add Item' })).toBeVisible()
})

test('the whole flow stays on our origin, with 44px controls and no native pop-ups', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? 'http://localhost:4173').origin
  const foreign: string[] = []
  let nativeDialog = false
  page.on('request', (req) => {
    const url = req.url()
    if (url.startsWith('data:') || url.startsWith('blob:')) return
    // The fake Supabase project is answered in the browser (e2e/fake-supabase.ts), never reached.
    const from = new URL(url).origin
    if (from !== origin && from !== FAKE_SUPABASE_ORIGIN) foreign.push(url)
  })
  page.on('dialog', async (d) => {
    nativeDialog = true
    await d.dismiss()
  })
  const dialog = await openReview(page)
  await dialog.getByRole('button', { name: 'Edit details of Gentle Gel Wash' }).click()
  const small = await dialog
    .locator('button, input[type=text], input[type=date], textarea, label:has(input)')
    .evaluateAll((els) =>
      els
        .filter((el) => {
          const box = el.getBoundingClientRect()
          return box.width > 0 && box.height < 44
        })
        .map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)),
    )
  expect(small).toEqual([])
  await dialog.getByRole('button', { name: 'Done' }).click()
  await dialog.getByRole('button', { name: /to my shelves/ }).click()
  await expect(dialog.getByRole('status')).toBeVisible()
  expect(foreign).toEqual([])
  expect(nativeDialog).toBe(false)
})

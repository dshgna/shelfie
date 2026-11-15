import { expect, test, type Page } from '@playwright/test'

// The skincare routine on the Inventory tab, with the app's invented example items:
// Cleansing Balm (step 1), Gel Cleanser (step 2) and Eye Cream (an extra, expired 12 days ago).

const routine = (page: Page) => page.getByRole('region', { name: 'Skincare Routine' })

const STEPS = [
  'Step 1 · Oil Cleanser',
  'Step 2 · Water Cleanser',
  'Step 3 · Toner',
  'Step 4 · Essence',
  'Step 5 · Serum or Ampoule',
  'Step 6 · Moisturiser',
  'Step 7 · Sun Protection',
]

test('shows the steps in order, then the extras, with how many are covered', async ({ page }) => {
  await page.goto('/')
  const section = routine(page)
  await expect(section.getByRole('heading', { name: 'Skincare Routine' })).toBeVisible()
  await expect(
    section.getByText('2 of 7 steps stocked. 5 to go for the full Korean routine.'),
  ).toBeVisible()
  const labels = await section.locator(':scope > ul > li > p:first-child').allTextContents()
  expect(labels).toEqual([...STEPS, 'Eye Cream'])
})

test('each item shows its status in words and an icon, not colour alone', async ({ page }) => {
  await page.goto('/')
  const section = routine(page)
  const eye = section.locator('li').filter({ hasText: 'Eye Cream' }).last()
  const chip = eye.getByText('Expired 12 days ago')
  await expect(chip).toBeVisible()
  const icon = chip.locator('img')
  await expect(icon).toHaveAttribute('alt', '')
  expect(await icon.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

  const balm = section.locator('li').filter({ hasText: 'Cleansing Balm' })
  await expect(balm.getByText(/^\d+% left$/)).toBeVisible()
  const gel = section.locator('li').filter({ hasText: 'Gel Cleanser' })
  await expect(
    gel
      .locator('span')
      .filter({ hasText: /^2 left$/ })
      .locator('img'),
  ).toHaveCount(1)
})

test('an empty step is a Gap card whose button adds a product to that step', async ({ page }) => {
  await page.goto('/')
  const section = routine(page)
  await expect(section.getByText('Gap', { exact: true })).toHaveCount(5)

  await section.getByRole('button', { name: 'Add a product to Step 4 · Essence' }).click()
  const editor = page.getByRole('dialog', { name: 'Add Item' })
  await expect(editor.getByRole('button', { name: /Shelf/ })).toContainText('Skincare')
  await expect(editor.getByRole('button', { name: /Group/ })).toContainText('Step 4 · Essence')
  await expect(editor.getByRole('textbox', { name: 'Name' })).toBeFocused()

  await editor.getByRole('textbox', { name: 'Name' }).fill('Green Tea Essence')
  await editor.getByRole('button', { name: 'Save item' }).click()
  await expect(editor).toBeHidden()
  await expect(
    section.getByText('3 of 7 steps stocked. 4 to go for the full Korean routine.'),
  ).toBeVisible()
  await expect(
    section.getByRole('button', { name: 'Add a product to Step 4 · Essence' }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open Green Tea Essence to edit' })).toBeFocused()
})

test('with a search, steps without a match and gaps are hidden', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox').fill('cleans')
  const section = routine(page)
  await expect(section.getByText('Gap', { exact: true })).toHaveCount(0)
  await expect(section.locator(':scope > ul > li')).toHaveCount(2)
  await page.getByRole('searchbox').fill('dish soap')
  await expect(routine(page)).toHaveCount(0)
})

test('shows under All and Personal Care, not under other sections', async ({ page }) => {
  await page.goto('/')
  const shelves = page.getByRole('tablist', { name: 'Shelves' })
  await shelves.getByRole('tab', { name: /Home Care/ }).click()
  await expect(routine(page)).toHaveCount(0)
  await shelves.getByRole('tab', { name: /Personal Care/ }).click()
  await expect(routine(page)).toBeVisible()
})

test('routine controls are at least 44px', async ({ page }) => {
  await page.goto('/')
  const small = await routine(page)
    .locator('button')
    .evaluateAll((els) =>
      els
        .filter((el) => {
          const box = el.getBoundingClientRect()
          return box.height < 44 || box.width < 44
        })
        .map((el) => el.getAttribute('aria-label') ?? el.textContent),
    )
  expect(small).toEqual([])
})

import { expect, test } from '@playwright/test'

test('main actions are the same size: 168px on web, equal halves on phone', async ({ page }) => {
  await page.goto('/')
  const fill = await page.getByRole('button', { name: 'Fill my shelves' }).boundingBox()
  const shop = await page.getByRole('button', { name: 'Shop now' }).boundingBox()
  expect(fill && shop).toBeTruthy()
  if (!fill || !shop) return
  expect(fill.width).toBeCloseTo(shop.width, 0)
  expect(fill.height).toBeCloseTo(shop.height, 0)
  expect(fill.height).toBeGreaterThanOrEqual(44)
  const width = page.viewportSize()?.width ?? 0
  if (width >= 768) expect(fill.width).toBeCloseTo(168, 0)
  else expect(fill.width + shop.width).toBeGreaterThan((width - 32) * 0.9)
})

test('Shop now opens the Shopping tab', async ({ page }) => {
  await page.goto('/')
  const pages = page.getByRole('tablist', { name: 'Pages' })
  await expect(pages.getByRole('tab', { name: /Inventory/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('button', { name: 'Shop now' }).click()
  await expect(pages.getByRole('tab', { name: /Shopping/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('Fill my shelves opens a placeholder that closes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Fill my shelves' }).click()
  const dialog = page.getByRole('dialog', { name: 'Fill my shelves' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('shelf sections are tabs, and the Filter button opens its panel', async ({ page }) => {
  await page.goto('/')
  const shelves = page.getByRole('tablist', { name: 'Shelves' })
  await shelves.getByRole('tab', { name: /Laundry/ }).click()
  await expect(shelves.getByRole('tab', { name: /Laundry/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const filter = page.getByRole('button', { name: /^Filter/ })
  await expect(filter).toHaveAttribute('aria-expanded', 'false')
  await filter.click()
  await expect(filter).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /Sort: name/ })).toBeVisible()
})

test('the restock count in the summary sets the Show filter', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /to restock/ }).click()
  await expect(page.getByRole('button', { name: /Needs restocking/ })).toBeVisible()
})

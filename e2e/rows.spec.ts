import { expect, test, type Locator, type Page } from '@playwright/test'

// The item rows on the Inventory tab, on the app's invented example items:
// Gel Cleanser (2 tubes), Oat Shampoo (1 bottle, needs restocking),
// Kitchen Sponges (0 left) and Beeswax Candle (a unit with no icon of its own).

function row(page: Page, name: string): Locator {
  return page.getByRole('listitem').filter({
    has: page.getByRole('button', { name: `Open ${name} to edit` }),
  })
}

/** The label inside the row's icon SVG, such as "Bottle, nearly empty". */
async function iconLabel(page: Page, name: string): Promise<string> {
  const img = row(page, name).locator('img')
  await expect(img).toHaveJSProperty('complete', true)
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  const src = (await img.getAttribute('src')) ?? ''
  // Small icons are inlined as data: URLs; larger ones would be files on our own origin.
  const svg = src.startsWith('data:')
    ? decodeURIComponent(src.slice(src.indexOf(',') + 1))
    : await (await page.request.get(src)).text()
  return /aria-label=["']([^"']+)["']/.exec(svg)?.[1] ?? ''
}

test('plus and minus are named after the item and change its count', async ({ page }) => {
  await page.goto('/')
  const gel = row(page, 'Gel Cleanser')
  await expect(gel.getByText('2 left')).toBeVisible()

  const add = page.getByRole('button', { name: 'Add one Gel Cleanser' })
  await add.click()
  await expect(gel.getByText('3 left')).toBeVisible()
  await expect(add).toBeFocused()

  await page.getByRole('button', { name: 'Remove one Gel Cleanser' }).click()
  await page.getByRole('button', { name: 'Remove one Gel Cleanser' }).click()
  await expect(gel.getByText('1 left')).toBeVisible()
})

test('minus stops at 0 and keeps focus', async ({ page }) => {
  await page.goto('/')
  const sponges = row(page, 'Kitchen Sponges')
  const remove = page.getByRole('button', { name: 'Remove one Kitchen Sponges' })
  await expect(sponges.getByText('0 left')).toBeVisible()
  await remove.click()
  await expect(sponges.getByText('0 left')).toBeVisible()
  await expect(remove).toBeFocused()
})

test('the stock count reaches the stats and the Shopping tab', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /3 to restock/ })).toBeVisible()
  // Oat Shampoo is low with 1 left; at 2 it is above its reorder point.
  await page.getByRole('button', { name: 'Add one Oat Shampoo' }).click()
  await expect(page.getByRole('button', { name: /2 to restock/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Shopping/ })).toContainText('2')
})

test('each row shows its container icon, the low one when it needs restocking', async ({
  page,
}) => {
  await page.goto('/')
  expect(await iconLabel(page, 'Gel Cleanser')).toBe('Tube, 70% left')
  expect(await iconLabel(page, 'Oat Shampoo')).toBe('Bottle, nearly empty')
  expect(await iconLabel(page, 'Kitchen Sponges')).toBe('Sponge, nearly empty')
  // "candle" has no icon of its own, so it falls back to box.svg.
  expect(await iconLabel(page, 'Beeswax Candle')).toBe('Box, 70% left')
  // The icon is decorative: the row's name and stock bar say the same thing.
  await expect(row(page, 'Gel Cleanser').locator('img')).toHaveAttribute('alt', '')
})

test('the icon switches to the low one when stock runs low', async ({ page }) => {
  await page.goto('/')
  // Toothpaste: 3 tubes, reorder at 1 left.
  expect(await iconLabel(page, 'Mint Toothpaste')).toBe('Tube, 70% left')
  await page.getByRole('button', { name: 'Remove one Mint Toothpaste' }).click()
  await page.getByRole('button', { name: 'Remove one Mint Toothpaste' }).click()
  await expect(row(page, 'Mint Toothpaste').getByText('1 left')).toBeVisible()
  expect(await iconLabel(page, 'Mint Toothpaste')).toBe('Tube, nearly empty')
})

test('the stock bar is a meter named after the item', async ({ page }) => {
  await page.goto('/')
  const meter = page.getByRole('meter', { name: 'Kitchen Sponges stock' })
  await expect(meter).toHaveAttribute('aria-valuenow', '0')
  await expect(meter).toHaveAttribute('aria-valuetext', '0% left')
  await page.getByRole('button', { name: 'Add one Kitchen Sponges' }).click()
  await expect(meter).not.toHaveAttribute('aria-valuenow', '0')
})

test('row controls are at least 44px', async ({ page }) => {
  await page.goto('/')
  const small = await page
    .getByRole('tabpanel')
    .locator('li button')
    .evaluateAll((els) =>
      els
        .filter((el) => {
          const box = el.getBoundingClientRect()
          return box.height < 44 || box.width < 44
        })
        .map((el) => el.getAttribute('aria-label')),
    )
  expect(small).toEqual([])
})

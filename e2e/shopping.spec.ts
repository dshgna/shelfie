import { expect, test } from '@playwright/test'

// The Shopping tab, on the app's invented example items. Their links use the reserved .example
// domain; the tests never open them.

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('Shop now opens the Shopping tab, grouped by shop with the unlinked items last', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Shop now' }).click()
  const panel = page.getByRole('tabpanel', { name: /Shopping/ })
  await expect(panel.getByRole('heading', { level: 3 })).toHaveText([
    'corner-shop.example',
    'refill.example',
  ])
  await expect(panel.getByRole('checkbox', { name: /Oat Shampoo/ })).toBeAttached()
})

test('opens only https links, in a new tab, without opener or referrer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: /Shopping/ }).click()
  const links = page.getByRole('tabpanel').getByRole('link')
  await expect(links).not.toHaveCount(0)
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('href', /^https:\/\//)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
  // The invented http link is offered as https, with a note that it wasn't checked.
  await expect(page.getByText(/couldn't check that it works/)).toBeVisible()
})

test('Copy list copies the list on a tap and says so', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: /Shopping/ }).click()
  const panel = page.getByRole('tabpanel')
  await panel.getByRole('button', { name: 'Copy list' }).click()
  await expect(panel.getByRole('status')).toHaveText('Shopping list copied')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied.split('\n')[0]).toBe('Shopping list')
  expect(copied).toContain('- Oat Shampoo x1 (bottle)')
})

test('ticks an item, changes how many, and adds it to stock', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: /Shopping/ }).click()
  const panel = page.getByRole('tabpanel')
  const add = panel.getByRole('button', { name: /checked to stock/ })
  await expect(add).toBeDisabled()

  await panel.getByRole('button', { name: 'Increase Number of Oat Shampoo to buy' }).click()
  await expect(panel.getByRole('textbox', { name: 'Number of Oat Shampoo to buy' })).toHaveValue(
    '2',
  )
  await panel.getByText('Oat Shampoo', { exact: true }).click()
  await expect(panel.getByRole('checkbox', { name: /Oat Shampoo/ })).toBeChecked()
  await expect(add).toHaveText('Add 1 checked to stock')
  await add.click()
  await expect(panel.getByRole('status')).toHaveText('1 item restocked')
  await expect(panel.getByText('Oat Shampoo', { exact: true })).toHaveCount(0)

  await page.getByRole('tab', { name: /Inventory/ }).click()
  const row = page.getByRole('listitem').filter({ hasText: 'Oat Shampoo' })
  await expect(row.locator('[aria-live]')).toHaveText('3 left')
})

test('every control is at least 44px and nothing leaves our origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:4173').origin
  const foreign: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (url.startsWith('data:') || url.startsWith('blob:')) return
    if (new URL(url).origin !== origin) foreign.push(url)
  })
  await page.goto('/')
  await page.getByRole('tab', { name: /Shopping/ }).click()
  const panel = page.getByRole('tabpanel')
  await panel.getByRole('button', { name: 'Copy list' }).click()
  await panel.getByRole('button', { name: 'Copy corner-shop.example links' }).click()

  const small = await panel
    .locator('button, a, input[type=text], label:has(input[type=checkbox])')
    .evaluateAll((els) =>
      els
        .filter((el) => {
          const box = el.getBoundingClientRect()
          return box.width > 0 && (box.height < 44 || box.width < 44)
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    )
  expect(small).toEqual([])
  expect(foreign).toEqual([])
})

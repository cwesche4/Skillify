import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test.describe('Inspector basics (e2e)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto(`${baseURL}/__e2e/inspector`)
    await expect(page.getByTestId('inspector-root')).toBeVisible()
  })

  test('toggles inspector via ] shortcut', async ({ page }) => {
    await page.keyboard.press(']')
    await expect(page.getByTestId('inspector-open-btn')).toBeVisible()
    await page.getByTestId('inspector-open-btn').click()
    await expect(page.getByTestId('inspector-root')).toBeVisible()
  })

  test('pin and unpin updates pinned state indicator', async ({ page }) => {
    const pinState = page.getByTestId('pin-state')
    await expect(pinState).toContainText('pinned:false')
    await page.getByTestId('inspector-pin-toggle').click()
    await expect(pinState).toContainText('pinned:true')
    await page.getByTestId('inspector-pin-toggle').click()
    await expect(pinState).toContainText('pinned:false')
  })

  test('width presets update width state', async ({ page }) => {
    const widthState = page.getByTestId('width-state')
    await page.getByTestId('inspector-preset-compact').click()
    await expect(widthState).toContainText('width:compact')
    await page.getByTestId('inspector-preset-standard').click()
    await expect(widthState).toContainText('width:standard')
    await page.getByTestId('inspector-preset-wide').click()
    await expect(widthState).toContainText('width:wide')
  })

  test('follow-selection toggle updates indicator', async ({ page }) => {
    const followState = page.getByTestId('follow-state')
    await expect(followState).toContainText('follow:true')
    await page.getByTestId('inspector-follow-toggle').click()
    await expect(followState).toContainText('follow:false')
  })

  test('preset save / apply / delete flow', async ({ page }) => {
    const presetName = 'preset-one'
    const nameInput = page.getByPlaceholder('Preset name')
    await nameInput.fill(presetName)
    await page.getByTestId('inspector-preset-save').click()

    const applySelect = page.getByTestId('inspector-preset-apply')
    await expect(
      applySelect.locator('option', { hasText: presetName }),
    ).toHaveCount(1)
    await applySelect.selectOption(presetName)

    await nameInput.fill(presetName)
    await page.getByTestId('inspector-preset-delete').click()
    await expect(
      applySelect.locator('option', { hasText: presetName }),
    ).toHaveCount(0)
  })

  test('AI disabled hides suggestion strip', async ({ page }) => {
    await expect(page.locator('text=AI suggestion')).toHaveCount(0)
  })

  test('replay deep-link navigates to replay route', async ({ page }) => {
    await page.getByTestId('inspector-replay-link').click()
    await expect(page).toHaveURL(
      new RegExp('/dashboard/ws-test/automations/auto-test/replay'),
    )
  })

  test('validation errors render when config is invalid', async ({ page }) => {
    await page.getByLabel('Label').fill('')
    await expect(page.getByText('Validation states')).toBeVisible()
    await expect(page.getByText('Label is required')).toBeVisible()
  })
})

import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const dataFile = (name: string) => fileURLToPath(new URL(`../data/${name}`, import.meta.url))

async function closeSummary(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Data načtena – kontrola' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Zavřít', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('HR resolves an inconsistency, confirms a booking and both survive reload', async ({ page }) => {
  await page.goto('./')
  const summary = page.getByRole('dialog', { name: 'Data načtena – kontrola' })
  await expect(summary).toContainText('nevyřešených nesrovnalostí')
  await expect(summary).toContainText('odmítnutých řádků')
  await closeSummary(page)

  await page.getByRole('link', { name: /Kvalita dat/ }).click()
  const issue = page.getByTestId('issue-employees:utvar:Laboratore')
  await expect(issue).toContainText('návrh: Laboratoře')
  await issue.getByRole('button', { name: 'Uložit' }).click()
  await page.getByLabel('jen nevyřešené').uncheck()
  await expect(page.getByTestId('issue-employees:utvar:Laboratore')).toContainText('Opravit na „Laboratoře“')

  await page.getByRole('link', { name: 'Agenda', exact: true }).click()
  await expect(page.getByTestId('task-data')).toBeVisible()
  await page.getByTestId('task-confirm:T015').getByRole('link').click()
  await expect(page).toHaveURL(/sessions\?session=T015/)
  const session = page.getByTestId('session-T015')
  await expect(session.getByTestId('seats')).toHaveText('obsazeno 29 / 30 (29 z exportu + 0 potvrzeno)')
  await expect(session.getByText('volno 1')).toBeVisible()
  const attendee = session.locator('[data-testid^="attendee-"]').first()
  await attendee.getByRole('button', { name: 'Potvrdit', exact: true }).click()
  await expect(session.getByText('potvrzeno', { exact: true })).toBeVisible()
  await expect(session.getByTestId('seats')).toHaveText('obsazeno 30 / 30 (29 z exportu + 1 potvrzeno)')
  await expect(session.getByText('volno 0')).toBeVisible()

  await page.reload()
  await closeSummary(page)
  const reloaded = page.getByTestId('session-T015')
  await expect(reloaded.getByText('potvrzeno', { exact: true })).toBeVisible()

  await page.goto('./#/employees/E0134')
  await expect(page.getByRole('cell', { name: 'LAB-BEZ – Bezpečná práce v laboratoři' })).toBeVisible()
})

test('overview heatmap links to filtered employee list', async ({ page }) => {
  await page.goto('./')
  await closeSummary(page)
  await page.getByRole('link', { name: 'Přehled', exact: true }).click()
  await expect(page.getByText('Proškolenost podle útvarů')).toBeVisible()
  await page
    .getByRole('row', { name: /^Knihovna/ })
    .getByRole('link')
    .first()
    .click()
  await expect(page).toHaveURL(/department=Knihovna/)
  await expect(page.getByText(/^\d+ zaměstna(nec|nci|nců) odpovíd(á|ají) filtrům$/)).toBeVisible()
})

test('import accepts known exports and rejects unknown files', async ({ page }) => {
  await page.goto('./')
  await closeSummary(page)
  await page.getByRole('button', { name: 'Import' }).click()
  const importDialog = page.getByRole('dialog', { name: 'Import exportů' })

  await importDialog.getByLabel('Soubory CSV').setInputFiles({ name: 'nahodny.csv', mimeType: 'text/csv', buffer: Buffer.from('a;b\n1;2') })
  await importDialog.getByRole('button', { name: 'Načíst' }).click()
  await expect(importDialog).toContainText('nahodny.csv: neznámá hlavička souboru')

  await importDialog.getByLabel('Soubory CSV').setInputFiles(dataFile('terminy_skoleni.csv'))
  await importDialog.getByRole('button', { name: 'Načíst' }).click()
  await expect(importDialog).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Data načtena – kontrola' })).toBeVisible()
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('pages fit the screen and navigation is reachable', async ({ page }) => {
    const noHorizontalScroll = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.goto('./')
    await expect(page.getByRole('dialog', { name: 'Data načtena – kontrola' })).toBeVisible()
    await noHorizontalScroll()
    await closeSummary(page)
    await noHorizontalScroll()

    for (const [link, url] of [
      ['Zaměstnanci', /#\/employees$/],
      ['Kvalita dat', /#\/data-quality$/],
      ['Agenda', /#\/$/],
    ] as const) {
      await page.getByRole('button', { name: 'Menu' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      expect(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type)).not.toBe('date')
      await page.getByRole('dialog').getByRole('link', { name: link }).click()
      await expect(page).toHaveURL(url)
      await expect(page.getByRole('dialog')).toBeHidden()
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
      await noHorizontalScroll()
    }

    await page.goto('./#/sessions?session=T015')
    await expect(page.getByTestId('session-T015').getByRole('button', { name: 'Potvrdit', exact: true })).toBeVisible()
    await noHorizontalScroll()

    await page.goto('./#/sessions?session=T034')
    const controls = page.getByTestId('session-T034').locator('[data-testid^="attendee-"]').locator('button, select')
    await expect(controls.first()).toBeVisible()
    for (const box of await controls.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right)))
      expect(box).toBeLessThanOrEqual(390)
  })
})

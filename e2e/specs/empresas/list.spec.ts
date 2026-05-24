import { test, expect } from '@playwright/test'
import { EmpresasListPage } from '../../pages/empresas/list.page'

test.describe('Empresas List', () => {
  let listPage: EmpresasListPage

  test.beforeEach(async ({ page }) => {
    listPage = new EmpresasListPage(page)
    await listPage.goto()
  })

  test('shows empresa list with seed data', async () => {
    await expect(listPage.heading).toBeVisible()
    await expect(listPage.page.getByText(/empresas? con acceso/)).toBeVisible()
  })

  test('filters empresas by search', async () => {
    await listPage.search('Alpha')
    const visibleCount = await listPage.visibleRows.count()
    expect(visibleCount).toBeGreaterThanOrEqual(1)
  })

  test('shows empty result for non-matching search', async () => {
    await listPage.search('ZZZNonExistent')
    await expect(listPage.emptyMessage).toBeVisible()
  })

  test('navigates to empresa detail on click', async () => {
    const empresaLink = listPage.page.getByText('E2E Test Alpha').first()
    await empresaLink.click()
    await expect(listPage.page).toHaveURL(/\/dashboard\/empresas\//)
  })
})

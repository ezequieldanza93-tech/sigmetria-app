import { test, expect } from '@playwright/test'
import { EmpresasListPage } from '../../pages/empresas/list.page'
import { EmpresaDetailPage } from '../../pages/empresas/detail.page'

test.describe('Empresa Detail & Edit', () => {
  test('displays empresa tabs correctly', async ({ page }) => {
    const listPage = new EmpresasListPage(page)
    await listPage.goto()

    const empresaLink = listPage.page.getByText('E2E Test Alpha').first()
    await empresaLink.click()

    await expect(page).toHaveURL(/\/dashboard\/empresas\//)

    const detailPage = new EmpresaDetailPage(page)
    await expect(detailPage.establecimientosTab).toBeVisible()
    await expect(detailPage.fichaTab).toBeVisible()
    await expect(detailPage.dashboardTab).toBeVisible()
  })

  test('navigates between enterprise tabs', async ({ page }) => {
    const listPage = new EmpresasListPage(page)
    await listPage.goto()

    const empresaLink = listPage.page.getByText('E2E Test Alpha').first()
    await empresaLink.click()

    const detailPage = new EmpresaDetailPage(page)

    await detailPage.fichaTab.click()
    await expect(page).toHaveURL(/tab=ficha/)

    await detailPage.dashboardTab.click()
    await expect(page).toHaveURL(/tab=dashboard/)

    await detailPage.establecimientosTab.click()
    await expect(page).not.toHaveURL(/tab=/)
  })
})

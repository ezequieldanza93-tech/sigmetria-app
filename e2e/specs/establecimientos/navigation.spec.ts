import { test, expect } from '@playwright/test'
import { EmpresasListPage } from '../../pages/empresas/list.page'
import { EstablecimientoDetailPage } from '../../pages/establecimientos/detail.page'

test.describe('Establecimiento Navigation', () => {
  async function navigateToFirstEstablecimiento(page: any) {
    const listPage = new EmpresasListPage(page)
    await listPage.goto()

    const empresaLink = listPage.page.getByText('E2E Test Alpha').first()
    await empresaLink.click()

    const estLink = page.locator('a[href*="establecimientos/"]').first()
    await estLink.click()

    await expect(page).toHaveURL(/\/establecimientos\//)
  }

  test('navigates to establecimiento from empresa detail', async ({ page }) => {
    await navigateToFirstEstablecimiento(page)
  })

  test('switches between establecimiento sections', async ({ page }) => {
    await navigateToFirstEstablecimiento(page)

    const detailPage = new EstablecimientoDetailPage(page)

    await expect(detailPage.agendaTab).toBeVisible()
    await expect(detailPage.fichaTab).toBeVisible()
    await expect(detailPage.dashboardTab).toBeVisible()
    await expect(detailPage.seguimientoTab).toBeVisible()

    await detailPage.navigateToSection('ficha')
    await expect(page).toHaveURL(/section=ficha/)

    await detailPage.navigateToSection('dashboard')
    await expect(page).toHaveURL(/section=dashboard/)

    await detailPage.navigateToSection('seguimiento')
    await expect(page).toHaveURL(/section=seguimiento/)

    await detailPage.navigateToSection('Gestiones')
    await expect(page).not.toHaveURL(/section=/)
  })
})

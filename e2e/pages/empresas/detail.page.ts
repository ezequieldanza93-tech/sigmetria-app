import { Page, expect } from '@playwright/test'

export class EmpresaDetailPage {
  constructor(readonly page: Page) {}

  async goto(empresaId: string) {
    await this.page.goto(`/dashboard/empresas/${empresaId}`)
  }

  get empresaName() {
    return this.page.locator('h1').first()
  }

  get establecimientosTab() {
    return this.page.getByRole('link', { name: 'Establecimientos' })
  }

  get fichaTab() {
    return this.page.getByRole('link', { name: 'Ficha' })
  }

  get dashboardTab() {
    return this.page.getByRole('link', { name: 'Dashboard' })
  }

  get editarLink() {
    return this.page.getByRole('link', { name: 'Editar información' })
  }

  async navigateToTab(tabName: string) {
    await this.page.getByRole('link', { name: tabName }).click()
  }

  async expectTabContent(tab: 'establecimientos' | 'ficha' | 'dashboard') {
    if (tab === 'establecimientos') {
      await expect(this.page.getByText(/establecimient/i).first()).toBeVisible()
    } else if (tab === 'ficha') {
      await expect(this.page.getByText('Domicilio')).toBeVisible()
    } else if (tab === 'dashboard') {
      await expect(this.page.getByText(/dashboard|analytics/i).first()).toBeVisible()
    }
  }

  get establecimientoLinks() {
    return this.page.locator('a[href*="establecimientos"]')
  }
}

import { Page, expect } from '@playwright/test'

export class EstablecimientoDetailPage {
  constructor(readonly page: Page) {}

  async goto(empresaId: string, estId: string) {
    await this.page.goto(`/dashboard/empresas/${empresaId}/establecimientos/${estId}`)
  }

  get agendaTab() {
    return this.page.getByRole('link', { name: /agenda/i })
  }

  get fichaTab() {
    return this.page.getByRole('link', { name: /ficha/i })
  }

  get dashboardTab() {
    return this.page.getByRole('link', { name: /dashboard/i })
  }

  get seguimientoTab() {
    return this.page.getByRole('link', { name: /seguimiento/i })
  }

  async navigateToSection(section: string) {
    await this.page.getByRole('link', { name: new RegExp(section, 'i') }).click()
  }

  async expectSectionContent(section: string) {
    if (section === 'agenda') {
      await expect(this.page.getByText(/agenda|riesgos?/i).first()).toBeVisible()
    } else if (section === 'ficha') {
      await expect(this.page.getByText(/sectores|siniestros/i).first()).toBeVisible()
    } else if (section === 'dashboard') {
      await expect(this.page.getByText(/dashboard|analytics/i).first()).toBeVisible()
    } else if (section === 'seguimiento') {
      await expect(this.page.getByText(/seguimiento|actuar/i).first()).toBeVisible()
    }
  }
}

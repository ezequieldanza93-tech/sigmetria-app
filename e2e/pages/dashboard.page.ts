import { Page } from '@playwright/test'

export class DashboardPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/dashboard')
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Empresas' })
  }

  get empresaCount() {
    return this.page.getByText(/empresas? con acceso/)
  }

  get searchInput() {
    return this.page.getByPlaceholder('Buscar por razon social o CUIT')
  }

  get nuevaEmpresaLink() {
    return this.page.getByRole('link', { name: /Nueva Empresa/ })
  }

  empresaLink(name: string) {
    return this.page.getByRole('link', { name }).first()
  }

  async search(text: string) {
    await this.searchInput.fill(text)
  }

  get emptyState() {
    return this.page.getByText('No tenes empresas asignadas')
  }
}

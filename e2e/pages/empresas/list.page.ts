import { Page } from '@playwright/test'

export class EmpresasListPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/dashboard/empresas')
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Empresas' })
  }

  get searchInput() {
    return this.page.getByPlaceholder('Buscar por razon social o CUIT')
  }

  get nuevaEmpresaButton() {
    return this.page.getByRole('link', { name: /Nueva Empresa/ })
  }

  empresaRow(name: string) {
    return this.page.getByRole('link', { name }).first()
  }

  get visibleRows() {
    return this.page.locator('table tbody tr')
  }

  async search(text: string) {
    await this.searchInput.fill(text)
  }

  get emptyMessage() {
    return this.page.getByText('Sin resultados')
  }

  async clickEmpresa(name: string) {
    await this.empresaRow(name).click()
  }
}

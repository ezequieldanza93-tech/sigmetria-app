import { Page } from '@playwright/test'

export class EmpresaNewPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/dashboard/empresas/nueva')
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Nueva Empresa' })
  }

  get razonSocialInput() {
    return this.page.getByLabel('Razón Social')
  }

  get cuitInput() {
    return this.page.getByLabel('Código único impositivo')
  }

  get domicilioInput() {
    return this.page.getByLabel('Domicilio')
  }

  get submitButton() {
    return this.page.getByRole('button', { name: 'Crear Empresa' })
  }

  async createEmpresa(razonSocial: string, cuit?: string, domicilio?: string) {
    await this.razonSocialInput.fill(razonSocial)
    if (cuit) await this.cuitInput.fill(cuit)
    if (domicilio) await this.domicilioInput.fill(domicilio)
    await this.submitButton.click()
  }
}

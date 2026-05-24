import { Page } from '@playwright/test'

export class LoginPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/login')
  }

  async fillEmail(email: string) {
    await this.page.getByLabel('Email').fill(email)
  }

  async fillPassword(password: string) {
    await this.page.getByLabel('Contraseña').fill(password)
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Ingresar' }).click()
  }

  async loginAs(email: string, password: string) {
    await this.goto()
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.submit()
    await this.page.waitForURL(/\/dashboard/)
  }

  get errorAlert() {
    return this.page.getByRole('alert')
  }
}

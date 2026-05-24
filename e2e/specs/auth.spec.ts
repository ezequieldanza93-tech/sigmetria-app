import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/login.page'

test.describe('Authentication', () => {
  test('redirects to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows error on invalid credentials', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.fillEmail('wrong@email.com')
    await login.fillPassword('wrongpassword')
    await login.submit()
    await expect(login.errorAlert).toBeVisible()
  })

  test('redirects to dashboard after successful login', async ({ page }) => {
    const email = process.env.E2E_TEST_USER_EMAIL!
    const password = process.env.E2E_TEST_USER_PASSWORD!
    const login = new LoginPage(page)

    await login.loginAs(email, password)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: 'Empresas' })).toBeVisible()
  })
})

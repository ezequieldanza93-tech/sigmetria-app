import { test as setup, expect } from '@playwright/test'
import { LoginPage } from '../pages/login.page'

const authFile = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_USER_EMAIL
  const password = process.env.E2E_TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error('Missing E2E_TEST_USER_EMAIL or E2E_TEST_USER_PASSWORD env vars')
  }

  const login = new LoginPage(page)
  await login.loginAs(email, password)

  await expect(page.getByRole('heading', { name: 'Empresas' })).toBeVisible()

  await page.context().storageState({ path: authFile })
})

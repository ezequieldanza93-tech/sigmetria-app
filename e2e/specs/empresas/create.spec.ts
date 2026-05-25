import { test, expect } from '@playwright/test'
import { EmpresaNewPage } from '../../pages/empresas/new.page'
import { EmpresasListPage } from '../../pages/empresas/list.page'

test.describe('Empresa Creation', () => {
  test('creates a new empresa successfully', async ({ page }) => {
    const newPage = new EmpresaNewPage(page)
    await newPage.goto()
    await expect(newPage.heading).toBeVisible()

    const uniqueName = `E2E Test Created ${Date.now()}`
    const consoleLogs: string[] = []
    page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`))
    page.on('pageerror', err => consoleLogs.push(`[PAGE_ERROR] ${err.message}`))

    await newPage.createEmpresa(uniqueName, '30987654322', 'Av. Test Creacion 123')

    // Wait for either redirect or 5 seconds
    await Promise.race([
      page.waitForURL(/\/dashboard\/empresas$/, { timeout: 10000 }),
      page.waitForTimeout(5000).then(async () => {
        // Check for error message
        const errorEl = page.locator('.bg-red-50')
        if (await errorEl.isVisible()) {
          const errorText = await errorEl.textContent()
          console.log('Form error:', errorText)
          console.log('Console logs:', consoleLogs.join('\n'))
        }
        throw new Error(`Form did not redirect. Current URL: ${page.url()}`)
      }),
    ])

    const listPage = new EmpresasListPage(page)
    await listPage.search(uniqueName)
    await expect(listPage.page.getByText(uniqueName)).toBeVisible()
  })
})

import { test, expect } from '@playwright/test'
import { EmpresaNewPage } from '../../pages/empresas/new.page'
import { EmpresasListPage } from '../../pages/empresas/list.page'

test.describe('Empresa Creation', () => {
  test('creates a new empresa successfully', async ({ page }) => {
    const newPage = new EmpresaNewPage(page)
    await newPage.goto()
    await expect(newPage.heading).toBeVisible()

    const uniqueName = `E2E Test Created ${Date.now()}`
    await newPage.createEmpresa(uniqueName, '30987654322', 'Av. Test Creacion 123')

    await expect(page).toHaveURL(/\/dashboard\/empresas$/)

    const listPage = new EmpresasListPage(page)
    await listPage.search(uniqueName)
    await expect(listPage.page.getByText(uniqueName)).toBeVisible()
  })
})

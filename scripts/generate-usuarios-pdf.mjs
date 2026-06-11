// Genera el PDF de una página a partir del HTML de referencia.
// Uso: node scripts/generate-usuarios-pdf.mjs
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const htmlPath = path.resolve(dir, '../docs/sistema-usuarios-y-accesos.html')
const pdfPath = path.resolve(dir, '../docs/sistema-usuarios-y-accesos.pdf')

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('file://' + htmlPath, { waitUntil: 'load' })
await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true })
await browser.close()
console.log('PDF generado en ' + pdfPath)

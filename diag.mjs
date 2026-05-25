import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ baseURL: 'http://localhost:3000' });

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));
page.on('response', res => { if (res.status() >= 400) logs.push(`[${res.status()}] ${res.url()}`) });

await page.goto('/login');
console.log('Page loaded');

await page.getByLabel('Email').fill('test@sigmetria.e2e');
await page.getByLabel('Contraseña').fill('TestE2E2026!');
console.log('Form filled');

await page.getByRole('button', { name: 'Ingresar' }).click();
console.log('Clicked submit');

await page.waitForTimeout(10000);

console.log('URL:', page.url());

const errorAlert = page.getByRole('alert');
if (await errorAlert.isVisible().catch(() => false)) {
  console.log('ERROR:', await errorAlert.textContent());
}

const btnText = await page.getByRole('button').first().textContent();
console.log('Button text:', btnText);

console.log('\n=== LOGS ===');
logs.forEach(l => console.log(l));

await browser.close();

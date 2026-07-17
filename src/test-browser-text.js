import { chromium } from 'playwright';

async function testPage() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://webapp.everything.co/');
  await page.waitForTimeout(5000);
  const text = await page.innerText('body');
  console.log('Page Text:', text.substring(0, 500));
  await browser.close();
}
testPage();

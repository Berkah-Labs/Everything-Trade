import { chromium } from 'playwright';

async function testLogin(email, password) {
  console.log('Testing browser login for:', email);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto('https://webapp.everything.co/');
    await page.waitForTimeout(5000);
    
    const html = await page.content();
    console.log('Page Title:', await page.title());
    
    // Cek apakah ada form login email/password
    const hasEmailInput = html.includes('type="email"') || html.toLowerCase().includes('email');
    const hasPasswordInput = html.includes('type="password"') || html.toLowerCase().includes('password');
    
    console.log('Has Email Input?', hasEmailInput);
    console.log('Has Password Input?', hasPasswordInput);
    
  } catch(e) {
    console.log('Error:', e.message);
  } finally {
    await browser.close();
  }
}

testLogin('hidnan', 'Bakulkalem1');

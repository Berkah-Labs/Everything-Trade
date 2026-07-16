/**
 * Mail.tm Email Client — tanpa browser
 *
 * Sama seperti di bot_ui_ext.js (line 37-103) tapi dalam modul terpisah
 */
import fetch from 'node-fetch';

const MAIL_API = 'https://api.mail.tm';

export class EmailClient {
  constructor() {
    this.email = null;
    this.token = null;
    this.password = null;
  }

  randomStr(len) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async createInbox() {
    console.log('  [MAIL] Membuat alamat email sementara...');

    // 1. Ambil domain
    const dRes = await fetch(`${MAIL_API}/domains`);
    const domains = (await dRes.json())['hydra:member'];
    if (!domains || domains.length === 0) {
      throw new Error('Gagal mengambil domain mail.tm');
    }

    const domain = domains[Math.floor(Math.random() * domains.length)].domain;
    this.email = `${this.randomStr(10)}@${domain}`;
    this.password = this.randomStr(16);

    // 2. Buat akun
    const aRes = await fetch(`${MAIL_API}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: this.email, password: this.password }),
    });

    if (!aRes.ok) throw new Error(`Gagal buat akun mail.tm: ${aRes.status}`);

    // 3. Dapatkan token
    const tRes = await fetch(`${MAIL_API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: this.email, password: this.password }),
    });

    this.token = (await tRes.json()).token;
    console.log(`  [MAIL] ✅ Email: ${this.email}`);
    return { email: this.email, token: this.token, password: this.password };
  }

  async waitForOtp(timeout = 120) {
    const start = Date.now();
    console.log(`  [OTP] Mengecek inbox (timeout: ${timeout}s)...`);

    while ((Date.now() - start) < timeout * 1000) {
      try {
        const elapsed = Math.round((Date.now() - start) / 1000);
        const mRes = await fetch(`${MAIL_API}/messages`, {
          headers: { 'Authorization': `Bearer ${this.token}` },
        });
        const data = await mRes.json();

        if (data['hydra:member']?.length > 0) {
          const msgSummary = data['hydra:member'][0];
          const msgId = msgSummary.id;

          const iRes = await fetch(`${MAIL_API}/messages/${msgId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` },
          });
          const msg = await iRes.json();

          const fullContent = `${msg.text || ''} ${msg.intro || ''} ${msg.html ? (typeof msg.html === 'string' ? msg.html : JSON.stringify(msg.html)) : ''}`;
          const match = fullContent.match(/\b(\d{4})\b/);

          if (match) {
            console.log(`  [OTP] ✅ Kode: ${match[1]} (${elapsed}s)`);
            return match[1];
          }
        } else {
          process.stdout.write(`\r  [OTP] Menunggu... (${elapsed}s/${timeout}s)`);
        }
      } catch (e) {
        // ignore
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    console.log('\n  [OTP] ❌ Timeout — tidak ada email masuk');
    return null;
  }
}

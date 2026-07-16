/**
 * Session Injection Client
 *
 * Mempertahankan session cookie secara manual antar request
 * tanpa perlu browser. Ini adalah inti dari "session injection".
 *
 * Cara kerja:
 * - Setiap response dari server kita ambil cookie-nya (JSESSIONID, dll)
 * - Cookie tersebut kita kirim balik di request berikutnya via header Cookie
 * - Ini simulasi dari apa yang dilakukan browser via credentials: "include"
 *   tapi tanpa perlu browser sama sekali
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://hp-sbt.everything.co/api';

export class SessionClient {
  constructor() {
    this.cookieJar = {};       // { "key": "value" } — session cookie storage
    this.lastResponse = null;  // response terakhir untuk debugging
  }

  /**
   * Ekstrak cookie dari response headers Set-Cookie
   */
  _extractCookies(res) {
    const setCookieHeaders = res.headers.raw()['set-cookie'] || [];
    for (const header of setCookieHeaders) {
      // Format: "JSESSIONID=abc123; Path=/; HttpOnly; SameSite=Lax"
      const [cookiePart] = header.split(';');
      const eqIdx = cookiePart.indexOf('=');
      if (eqIdx > 0) {
        const key = cookiePart.substring(0, eqIdx).trim();
        const value = cookiePart.substring(eqIdx + 1).trim();
        this.cookieJar[key] = value;
        console.log(`  [SESSION] Cookie tersimpan: ${key}=${value.substring(0, 20)}...`);
      }
    }
  }

  /**
   * Build cookie string untuk dikirim di request
   */
  _buildCookieHeader() {
    const entries = Object.entries(this.cookieJar);
    if (entries.length === 0) return undefined;
    return entries.map(([k, v]) => `${k}=${v}`).join('; ');
  }

  /**
   * Generic request dengan session injection
   */
  async request(method, path, body = null, extraHeaders = {}) {
    const url = `${BASE_URL}${path}`;
    const cookieStr = this._buildCookieHeader();

    const headers = {
      'Content-Type': 'application/json',
      'channel': 'minApp',
      'device-name': 'telegram',
      'device-type': 'web',
      'platformtype': 'web',
      'edition': '1.0.0',
      'device-id': '206545132',
      'referer': 'https://webapp.everything.co/',
      'visitor-id': '',
      'token': '',
      ...(cookieStr ? { 'Cookie': cookieStr } : {}),
      ...extraHeaders,
    };

    console.log(`\n>>> [${method}] ${url}`);
    if (body) console.log(`    Body: ${JSON.stringify(body).substring(0, 200)}`);

    const options = {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    };

    const res = await fetch(url, options);
    this.lastResponse = res;

    // Ekstrak cookie dari response
    this._extractCookies(res);

    const data = await res.json();
    console.log(`<<< [${method}] ${path} → ${res.status} | code: ${data.code || 'none'} | msg: ${(data.msg || '').substring(0, 60)}`);

    return { status: res.status, headers: res.headers, data };
  }

  /**
   * Helper methods
   */
  get(path, extraHeaders = {}) {
    return this.request('GET', path, null, extraHeaders);
  }

  post(path, body, extraHeaders = {}) {
    return this.request('POST', path, body, extraHeaders);
  }

  /**
   * Debug: tampilkan isi cookie jar
   */
  dumpCookies() {
    console.log('\n📋 Cookie Jar saat ini:');
    for (const [key, value] of Object.entries(this.cookieJar)) {
      console.log(`   ${key}: ${value.substring(0, 30)}...`);
    }
    if (Object.keys(this.cookieJar).length === 0) {
      console.log('   (kosong — belum ada session cookie)');
    }
  }
}

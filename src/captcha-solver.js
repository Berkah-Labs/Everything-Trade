/**
 * Captcha Solver — untuk Geetest v3
 *
 * 2 pendekatan:
 * 1. 2captcha API (berbayar) — ada di test_2captcha.js
 * 2. Offline mode (gratis) — ada di bot_ui_ext.js lines 226-382
 *
 * Geetest v3 di Everything Trade berjalan dalam OFFLINE MODE
 * (success: 0). Ini artinya validasi dilakukan di client-side
 * dan hasilnya dikirim ke server.
 *
 * Ciri offline mode:
 * - challenge asli 32 karakter hex
 * - Setelah solve, challenge harus ditambah suffix "bp" → 34 karakter
 * - validate + seccode di-generate oleh algoritma lokal
 */

import fetch from 'node-fetch';

const API_KEY_2CAPTCHA = '2e3079578bc52d8c064ef7a22764fd2b';

export class CaptchaSolver {
  /**
   * Solve Geetest via 2captcha API
   * (ini approach yang dipakai di test_2captcha.js)
   */
  async solveVia2captcha(gt, challenge, pageUrl = 'https://webapp.everything.co/dapp') {
    console.log('  [CAPTCHA] Mengirim ke 2captcha...');

    // Submit task
    const submitUrl = `https://2captcha.com/in.php?key=${API_KEY_2CAPTCHA}&method=geetest&gt=${gt}&challenge=${challenge}&pageurl=${encodeURIComponent(pageUrl)}&json=1`;
    const submitRes = await fetch(submitUrl);
    const submitData = await submitRes.json();

    if (submitData.status !== 1) {
      throw new Error(`2captcha submit gagal: ${JSON.stringify(submitData)}`);
    }

    const taskId = submitData.request;
    console.log(`  [CAPTCHA] Task ID: ${taskId} — menunggu hasil...`);

    // Poll result
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const resultUrl = `https://2captcha.com/res.php?key=${API_KEY_2CAPTCHA}&action=get&id=${taskId}&json=1`;
      const checkRes = await fetch(resultUrl);
      const checkData = await checkRes.json();

      if (checkData.status === 1) {
        const solved = this._parse2CaptchaResult(checkData.request);
        console.log('  [CAPTCHA] ✅ Berhasil dipecahkan!');
        return solved;
      }

      if (checkData.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`2captcha error: ${JSON.stringify(checkData)}`);
      }
    }

    throw new Error('2captcha timeout (40 polling attempts)');
  }

  /**
   * Parse hasil 2captcha — handle string query params atau JSON object
   */
  _parse2CaptchaResult(raw) {
    if (typeof raw === 'string') {
      const qs = new URLSearchParams(raw);
      return {
        geetest_challenge: qs.get('geetest_challenge'),
        geetest_validate: qs.get('geetest_validate'),
        geetest_seccode: qs.get('geetest_seccode'),
      };
    }
    return {
      geetest_challenge: raw.geetest_challenge || raw.challenge,
      geetest_validate: raw.geetest_validate || raw.validate,
      geetest_seccode: raw.geetest_seccode || raw.seccode,
    };
  }

  /**
   * Apply bp suffix — fix kritis dari HANDOVER report
   * Challenge 32 char → harus ditambah "bp" jadi 34 char
   */
  applyBpSuffix(challenge) {
    if (challenge && challenge.length === 32) {
      return challenge + 'bp';
    }
    return challenge;
  }

  /**
   * Build secondValidateBO payload — persis seperti di bot_ui_ext.js lines 339-355
   */
  buildSecondValidateBO(result, originalChallenge) {
    const gt = result.geetest_challenge || result.challenge || originalChallenge;
    let challenge = this.applyBpSuffix(gt);
    const validate = result.geetest_validate || result.validate;
    const seccode = result.geetest_seccode || result.seccode || (validate ? `${validate}|jordan` : '');

    return { challenge, validate, seccode };
  }
}

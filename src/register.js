/**
 * EVERYTHING TRADE — CORE REGISTRATION MODULE
 *
 * Extracted from register-flow.js. Shared between single and batch runners.
 *
 * Exports:
 *   register(reffCode)  → registers 1 account, returns account data
 *   saveAccounts(accounts) → atomic write to data/accounts.json
 *   readAccounts() → reads current accounts
 */
import fetch from 'node-fetch';
import { Wallet } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ACCOUNTS_FILE = path.resolve(__dirname, '../data/accounts.json');
const BASE = 'https://hp-sbt.everything.co/api';
const MAIL_API = 'https://api.mail.tm';
const CAPTCHA_KEY = process.env.CAPTCHA_KEY || '2e3079578bc52d8c064ef7a22764fd2b';

const HEADERS = {
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
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randStr = (l) => Array.from({ length: l }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const NAMES = ['alex', 'chloe', 'marco', 'nicolas', 'kenji', 'viktor', 'oliver', 'liam', 'mia', 'elena', 'sota', 'dimas', 'kevin', 'rayhan'];

const api = async (path, body) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  return await r.json();
};

async function createEmail() {
  const dRes = await fetch(MAIL_API + '/domains');
  const domains = (await dRes.json())['hydra:member'];
  if (!domains || domains.length === 0) throw new Error('No mail.tm domains');

  const domain = domains[Math.floor(Math.random() * domains.length)].domain;
  const email = `${randStr(10)}@${domain}`;
  const password = randStr(16);

  const aRes = await fetch(MAIL_API + '/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: email, password }),
  });
  if (!aRes.ok) throw new Error(`Email creation failed: ${aRes.status}`);

  const tRes = await fetch(MAIL_API + '/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: email, password }),
  });

  return { email, password, token: (await tRes.json()).token };
}

async function waitForOtp(mailToken, timeout = 180) {
  const start = Date.now();
  while ((Date.now() - start) < timeout * 1000) {
    const mRes = await fetch(MAIL_API + '/messages', {
      headers: { 'Authorization': `Bearer ${mailToken}` },
    });
    const mData = await mRes.json();

    if (mData['hydra:member']?.length > 0) {
      const iRes = await fetch(MAIL_API + '/messages/' + mData['hydra:member'][0].id, {
        headers: { 'Authorization': `Bearer ${mailToken}` },
      });
      const msg = await iRes.json();
      const content = `${msg.text || ''} ${msg.intro || ''} ${typeof msg.html === 'string' ? msg.html : JSON.stringify(msg.html || '')}`;
      const match = content.match(/\b(\d{4})\b/);
      if (match) return match[1];
    }
    process.stdout.write('.');
    await sleep(5000);
  }
  return null;
}

async function solveCaptcha(gt, challenge) {
  console.log('\n  [Captcha] Submit ke 2captcha...');
  const subUrl = `https://2captcha.com/in.php?key=${CAPTCHA_KEY}&method=geetest&gt=${gt}&challenge=${challenge}&pageurl=https://webapp.everything.co/dapp&json=1`;
  const subRes = await (await fetch(subUrl)).json();

  if (subRes.status !== 1) throw new Error(`2captcha submit failed: ${JSON.stringify(subRes)}`);
  const taskId = subRes.request;

  for (let i = 0; i < 50; i++) {
    process.stdout.write('.');
    await sleep(5000);
    const pollUrl = `https://2captcha.com/res.php?key=${CAPTCHA_KEY}&action=get&id=${taskId}&json=1`;
    const checkRes = await (await fetch(pollUrl)).json();

    if (checkRes.status === 1) {
      const sd = checkRes.request;
      const result = typeof sd === 'string'
        ? { challenge: new URLSearchParams(sd).get('geetest_challenge'), validate: new URLSearchParams(sd).get('geetest_validate'), seccode: new URLSearchParams(sd).get('geetest_seccode') }
        : { challenge: sd.geetest_challenge || sd.challenge, validate: sd.geetest_validate || sd.validate, seccode: sd.geetest_seccode || sd.seccode };

      // BP suffix — fix kritis offline mode
      let fc = result.challenge || challenge;
      if (fc && fc.length === 32) fc += 'bp';

      return { ...result, finalChallenge: fc };
    }
    if (checkRes.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`2captcha error: ${JSON.stringify(checkRes)}`);
    }
  }
  throw new Error('2captcha timeout');
}

// ─── Atomic file helpers ───

export function readAccounts() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch { return []; }
}

export function saveAccounts(accounts) {
  const tmpFile = ACCOUNTS_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(accounts, null, 2) + '\n');
  fs.renameSync(tmpFile, ACCOUNTS_FILE);
}

// ─── Main registration flow ───

export async function register(reffCode = 'hidnan') {
  // Step 1: Email
  console.log('📧 Step 1: Email sementara...');
  const mail = await createEmail();
  console.log(`   ${mail.email}`);

  // Step 2: Wallet
  const wallet = Wallet.createRandom();
  const nickname = NAMES[Math.floor(Math.random() * NAMES.length)] + randStr(4);
  console.log(`👛 Step 2: Wallet EVM`);
  console.log(`   Address : ${wallet.address}`);
  console.log(`   Nickname: ${nickname}`);

  // Step 3: Web3 Auth
  console.log('🔐 Step 3: Web3 Auth...');
  const msgRes = await api('/web3/getMessage', { walletAddress: wallet.address });
  const message = msgRes.data.message;
  const signature = await wallet.signMessage(message);

  await api('/web3/login', { walletAddress: wallet.address, signature, message });
  await api('/app/user/checkExit', { mobileNo: mail.email, loginType: 102 });
  console.log(`   ✅ Session established (wallet-based)`);

  // Step 4: Captcha (dengan retry)
  console.log('🧩 Step 4: Geetest captcha...');
  let captcha, initRes;
  for (let attempt = 1; attempt <= 3; attempt++) {
    initRes = await api('/code/init?loginFlag=2&t=' + Date.now(), {});
    try {
      captcha = await solveCaptcha(initRes.data.gt, initRes.data.challenge);
      break;
    } catch (e) {
      if (attempt < 3 && e.message.includes('UNSOLVABLE')) {
        console.log(`\n  ⚠️ Percobaan ke-${attempt} gagal, ambil challenge baru...`);
        await sleep(3000);
        continue;
      }
      throw e;
    }
  }
  console.log(`\n   ✅ Captcha solved`);

  // Step 5: Kirim OTP
  console.log('📱 Step 5: Kirim OTP...');
  const smsRes = await api('/app/user/sendSmsCode', {
    verifyCodeType: 4,
    bizType: 1,
    mobileNo: mail.email,
    secondValidateBO: {
      challenge: captcha.finalChallenge,
      validate: captcha.validate,
      seccode: captcha.seccode,
    },
  });

  if (smsRes.code !== '0') {
    throw new Error(`SMS gagal: ${JSON.stringify(smsRes)}`);
  }
  console.log(`   ✅ OTP terkirim`);

  // Step 6: Tunggu OTP
  console.log('⏳ Step 6: Tunggu OTP di email...');
  const otp = await waitForOtp(mail.token);
  if (!otp) {
    console.log('\n   ⏳ Perpanjang waktu tunggu...');
    await sleep(120000);
    const otp2 = await waitForOtp(mail.token, 300);
    if (!otp2) throw new Error('OTP timeout setelah perpanjangan');
  }
  console.log(`\n   ✅ OTP: ${otp}`);

  // Step 7: Verify OTP + Register
  const chkRes = await api('/app/user/checkSmsCode', {
    mobileNo: mail.email,
    verifyCode: otp,
    bizType: 1,
    verifyCodeType: 4,
  });
  if (chkRes.code !== '0') throw new Error(`Verifikasi OTP gagal: ${JSON.stringify(chkRes)}`);
  console.log('   ✅ OTP terverifikasi');

  console.log('📝 Step 7: Registrasi final...');
  const regRes = await api('/web3/register', {
    walletAddress: wallet.address,
    signature,
    message,
    referrerNickName: reffCode,
    nickName: nickname,
    email: mail.email,
  });

  if (regRes.code !== '0') throw new Error(`Register gagal: ${JSON.stringify(regRes)}`);

  const token = regRes.data.token;
  console.log('   ✅ REGISTRASI BERHASIL!');
  console.log(`   Token: ${token.substring(0, 30)}...`);

  // Step 8: Daily check-in
  console.log('🎯 Step 8: Daily check-in...');
  const chkinRes = await fetch(BASE + '/etoken/daily-checkin', {
    method: 'POST',
    headers: {
      'token': token,
      'Content-Type': 'application/json',
      'Channel': 'web',
      'Device-Type': 'web',
      'Platformtype': 'web',
    },
    body: '{}',
  });
  const chkinData = await chkinRes.json();
  console.log(`   ${chkinData.code === '0' ? '✅ Checkin sukses!' : `⚠️ ${JSON.stringify(chkinData).substring(0, 80)}`}`);

  // Return account data (caller decides when to save)
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    email: mail.email,
    emailPassword: mail.password,
    nickname,
    referrer: reffCode,
    token,
    cookie: '',
    enabled: true,
    createdAt: Date.now(),
  };
}

#!/usr/bin/env node
/**
 * EVERYTHING TRADE — DAILY CHECK-IN
 *
 * Usage: node src/checkin.js
 */
import fetch from 'node-fetch';
import { Wallet } from 'ethers';
import { readAccounts, saveAccounts } from './register.js';

const BASE = 'https://hp-sbt.everything.co/api';
const CONCURRENCY = 5;

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
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function api(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  return await r.json();
}

async function doCheckin(account, idx) {
  try {
    // 1. Re-login to renew token
    const wallet = new Wallet(account.privateKey);
    const msgRes = await api('/web3/getMessage', { walletAddress: wallet.address });
    if (msgRes.code !== '0') throw new Error(`Gagal getMessage: ${msgRes.msg || JSON.stringify(msgRes)}`);

    const message = msgRes.data.message;
    const signature = await wallet.signMessage(message);

    const loginRes = await api('/web3/login', { walletAddress: wallet.address, signature, message });
    if (loginRes.code !== '0') throw new Error(`Gagal login: ${loginRes.msg || JSON.stringify(loginRes)}`);

    // 2. Update token in memory
    account.token = loginRes.data.token;

    // 3. Perform check-in
    const res = await fetch(BASE + '/etoken/daily-checkin', {
      method: 'POST',
      headers: {
        'token': account.token,
        'Content-Type': 'application/json',
        'Channel': 'web',
        'Device-Type': 'web',
        'Platformtype': 'web',
      },
      body: '{}',
    });

    const data = await res.json();
    return { account, idx, success: data.code === '0', data };
  } catch (error) {
    return { account, idx, success: false, data: { message: error.message } };
  }
}

async function runWithConcurrency(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((item, idx) => fn(item, i + idx)));
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      await sleep(500); // Jeda antar batch
    }
  }
  return results;
}

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  EVERYTHING TRADE — DAILY CHECK-IN');
  console.log('══════════════════════════════════════════════════════════\n');

  const allAccounts = readAccounts();
  const validAccounts = allAccounts.filter(a => a.enabled && a.privateKey);

  if (validAccounts.length === 0) {
    console.log('❌ Tidak ada akun yang valid/aktif (butuh privateKey) untuk check-in.');
    return;
  }

  console.log(`🚀 Menjalankan check-in untuk ${validAccounts.length} akun (konkurensi: ${CONCURRENCY})...\n`);

  const startTime = Date.now();
  const results = await runWithConcurrency(validAccounts, CONCURRENCY, async (acc, idx) => {
    const result = await doCheckin(acc, idx);
    const status = result.success ? '✅' : '❌';
    const msg = result.success ? 'Berhasil' : (result.data?.message || 'Gagal');
    console.log(`  ${status} [${idx + 1}/${validAccounts.length}] ${(acc.nickname || 'Unknown').padEnd(12)} — ${msg}`);
    return result;
  });

  // Safe atomic merge: re-read accounts.json before saving so any new accounts
  // registered by background workers while checkin was running are NOT overwritten.
  const latestAccounts = readAccounts();
  for (const checked of validAccounts) {
    const match = latestAccounts.find(a =>
      (a.address && checked.address && a.address.toLowerCase() === checked.address.toLowerCase()) ||
      (a.email && checked.email && a.email === checked.email)
    );
    if (match && checked.token) {
      match.token = checked.token;
    }
  }
  saveAccounts(latestAccounts);
  console.log(`\n💾 Token baru telah disimpan ke data/accounts.json (Total akun aman: ${latestAccounts.length})`);

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  📊 SUMMARY');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  ✅ Berhasil : ${successCount}`);
  console.log(`  ❌ Gagal    : ${failedCount}`);
  console.log(`  ⏱️  Waktu    : ${elapsed}s`);
  console.log('══════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('\n❌ FATAL:', err.message);
  process.exit(1);
});

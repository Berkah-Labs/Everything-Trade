#!/usr/bin/env node
/**
 * EVERYTHING TRADE — BATCH REGISTRATION
 *
 * Interactive CLI untuk registrasi banyak akun sekaligus.
 * Prompt: jumlah akun + referral code (default jika kosong).
 *
 * Usage: node src/batch-register.js
 */
import { register, readAccounts, saveAccounts } from './register.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const CONCURRENCY = 1; // 1 worker (sequential)

function prompt(question) {
  const rl = readline.createInterface({ input, output });
  return rl.question(question).finally(() => rl.close());
}

// ─── Concurrency control ───

async function runWithConcurrency(total, concurrency, fn) {
  const results = [];
  for (let i = 0; i < total; i += concurrency) {
    const batchSize = Math.min(concurrency, total - i);
    const batchTasks = Array.from({ length: batchSize }, (_, j) => i + j);
    console.log(`\n── Batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(total / concurrency)} ──\n`);
    const batchResults = await Promise.all(
      batchTasks.map(idx => fn(idx).catch(err => ({ _error: err.message, _index: idx })))
    );
    results.push(...batchResults);
    if (i + concurrency < total) {
      console.log(`\n⏳ Jeda 1.5 detik sebelum batch berikutnya...`);
      await sleep(1500);
    }
  }
  return results;
}

function printSummary(accounts) {
  const success = accounts.filter(a => !a._error);
  const failed = accounts.filter(a => a._error);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  📊 BATCH REGISTRATION — SUMMARY');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  ✅ Berhasil : ${success.length}`);
  console.log(`  ❌ Gagal    : ${failed.length}`);
  console.log(`  📁 File     : data/accounts.json`);

  if (failed.length > 0) {
    console.log('\n  ── Detail Gagal ──');
    failed.forEach(f => console.log(`  #${f._index + 1}: ${f._error}`));
  }

  if (success.length > 0) {
    console.log('\n  ── Akun Baru ──');
    success.forEach(a => {
      console.log(`  #${a._index + 1}: ${a.email} | ${a.address.substring(0, 10)}... | nick: ${a.nickname}`);
    });
  }
  console.log('══════════════════════════════════════════════════════════\n');
}

// ─── Main ───

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  EVERYTHING TRADE — BATCH REGISTRATION');
  console.log('══════════════════════════════════════════════════════════\n');

  // Prompt interaktif
  const countStr = await prompt('📊 Jumlah akun yang mau didaftarkan: ');
  const count = parseInt(countStr, 10);
  if (isNaN(count) || count < 1) {
    console.error('❌ Jumlah tidak valid. Masukkan angka >= 1');
    process.exit(1);
  }

  let reffCode = await prompt('👥 Referral code (enter untuk default \'hidnan\'): ');
  reffCode = reffCode.trim() || 'hidnan';

  console.log(`\n🚀 Memulai registrasi ${count} akun (konkurensi: ${CONCURRENCY}, referral: ${reffCode})...`);

  const startTime = Date.now();

  const results = await runWithConcurrency(count, CONCURRENCY, async (idx) => {
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`  👤 Akun #${idx + 1}/${count}`);
    console.log(`${'─'.repeat(40)}`);
    const account = await register(reffCode);
    account._index = idx;
    return account;
  });

  // Pisahkan sukses dan gagal
  const success = results.filter(a => !a._error);
  const failed = results.filter(a => a._error);

  // Atomic save — hanya akun sukses
  if (success.length > 0) {
    const existing = readAccounts();
    const cleanSuccess = success.map(a => {
      const { _index, _error, ...data } = a;
      return data;
    });
    saveAccounts([...existing, ...cleanSuccess]);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total waktu: ${elapsed}s`);
  printSummary(results);
}

main().catch(err => {
  console.error('\n❌ FATAL:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * EVERYTHING TRADE — BATCH & CONTINUOUS REGISTRATION
 *
 * Supports:
 *   Interactive prompt : node src/batch-register.js
 *   CLI batch args     : node src/batch-register.js --count 50 --reff hidnan
 *   Continuous loop    : node src/batch-register.js --loop --reff hidnan,azzura,sansan,raihanadhe,zurzur --delay 4000
 *
 * Guaranteed Slot Fulfillment:
 *   If an account creation fails (e.g. timeout, rate limit), the slot is NEVER skipped.
 *   The worker will keep retrying that exact slot until a valid account is created and saved.
 */
import { register, readAccounts, saveAccounts } from './register.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const CONCURRENCY = 1; // 1 worker (sequential) to keep 2captcha and mail.tm safe

function prompt(question) {
  const rl = readline.createInterface({ input, output });
  return rl.question(question).finally(() => rl.close());
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { loop: false, count: null, reff: 'hidnan', delay: 4000 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--loop' || args[i] === '-l') parsed.loop = true;
    else if (args[i] === '--count' || args[i] === '-c') parsed.count = parseInt(args[++i], 10);
    else if (args[i] === '--reff' || args[i] === '-r' || args[i] === '--reffs') parsed.reff = args[++i];
    else if (args[i] === '--delay' || args[i] === '-d') parsed.delay = parseInt(args[++i], 10);
  }
  return parsed;
}

function pickReferral(reffInput) {
  if (!reffInput) return 'hidnan';
  const list = reffInput.split(',').map(s => s.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] || 'hidnan';
  // Asymmetrical weighted random selection among multiple referrals
  // Slight weight variations so distribution looks organic (~18% - 22% each)
  const weights = [22, 19, 21, 18, 20, 23, 17];
  let totalWeight = 0;
  const itemWeights = list.map((item, i) => {
    const w = weights[i % weights.length];
    totalWeight += w;
    return { item, w };
  });
  let rand = Math.random() * totalWeight;
  for (const { item, w } of itemWeights) {
    if (rand < w) return item;
    rand -= w;
  }
  return list[0];
}

// ─── Concurrency control for batch ───

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
      console.log(`  #${a._index + 1}: ${a.email} | ${a.address.substring(0, 10)}... | nick: ${a.nickname} | reff: ${a.referrer}`);
    });
  }
  console.log('══════════════════════════════════════════════════════════\n');
}

// ─── Main ───

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  EVERYTHING TRADE — BATCH & LOOP REGISTRATION');
  console.log('══════════════════════════════════════════════════════════\n');

  const cliArgs = parseArgs();

  // 1. Continuous Loop Mode
  if (cliArgs.loop) {
    console.log(`♾️ Mode LOOP aktif! Registrasi berjalan terus-menerus (1 Worker, Tanpa Skip Slot)`);
    console.log(`👥 Referral Pool : ${cliArgs.reff}`);
    console.log(`⏳ Jeda          : ${cliArgs.delay}ms antar akun\n`);

    let idx = 0;
    while (true) {
      idx++;
      const selectedReff = pickReferral(cliArgs.reff);
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`  👤 Akun Loop #${idx} | Reff: [${selectedReff}] | ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`);
      console.log(`${'─'.repeat(50)}`);

      let success = false;
      let attempt = 0;
      while (!success) {
        attempt++;
        if (attempt > 1) {
          console.log(`\n  🔄 [Slot #${idx}] Percobaan ulang ke-${attempt} untuk mengisi slot #${idx} (Reff: ${selectedReff})...`);
        }
        try {
          const account = await register(selectedReff);
          account._index = idx - 1;
          if (!account.referrer) account.referrer = selectedReff;

          // Atomic save langsung setiap 1 akun sukses
          const existing = readAccounts();
          const { _index, _error, ...data } = account;
          existing.push(data);
          saveAccounts(existing);
          console.log(`  💾 Slot #${idx} sukses diisi (${data.email}) | Reff: ${selectedReff}! Total akun di accounts.json: ${existing.length}`);
          success = true;
        } catch (err) {
          console.error(`  ⚠️ Gagal pada Slot #${idx} (${err.message}). Jeda 6 detik sebelum mencoba ulang slot #${idx} agar tidak di-skip...`);
          await sleep(6000);
        }
      }

      console.log(`\n⏳ Jeda ${cliArgs.delay / 1000} detik sebelum akun berikutnya...`);
      await sleep(cliArgs.delay);
    }
  }

  // 2. Batch Mode (Interactive / CLI arg)
  let count = cliArgs.count;
  let reffCode = cliArgs.reff;

  if (!count) {
    const countStr = await prompt('📊 Jumlah akun yang mau didaftarkan: ');
    count = parseInt(countStr, 10);
    if (isNaN(count) || count < 1) {
      console.error('❌ Jumlah tidak valid. Masukkan angka >= 1');
      process.exit(1);
    }
    let promptReff = await prompt(`👥 Referral pool (enter untuk default '${reffCode}'): `);
    promptReff = promptReff.trim();
    if (promptReff) reffCode = promptReff;
  }

  console.log(`\n🚀 Memulai registrasi ${count} akun (konkurensi: ${CONCURRENCY}, referral pool: ${reffCode}, Tanpa Skip Slot)...`);

  const startTime = Date.now();

  const results = await runWithConcurrency(count, CONCURRENCY, async (idx) => {
    const selectedReff = pickReferral(reffCode);
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`  👤 Akun Slot #${idx + 1}/${count} | Reff: [${selectedReff}]`);
    console.log(`${'─'.repeat(40)}`);

    let account = null;
    let success = false;
    let attempt = 0;
    while (!success) {
      attempt++;
      if (attempt > 1) {
        console.log(`\n  🔄 [Slot #${idx + 1}/${count}] Percobaan ulang ke-${attempt} untuk mengisi slot #${idx + 1}...`);
      }
      try {
        account = await register(selectedReff);
        account._index = idx;
        if (!account.referrer) account.referrer = selectedReff;

        // Atomic save per account to keep data safe during long runs
        const existing = readAccounts();
        const { _index, _error, ...data } = account;
        existing.push(data);
        saveAccounts(existing);
        console.log(`  💾 Slot #${idx + 1} sukses diisi (${data.email}) | Reff: ${selectedReff}!`);
        success = true;
      } catch (err) {
        console.error(`  ⚠️ Gagal pada Slot #${idx + 1} (${err.message}). Jeda 6 detik sebelum mencoba ulang slot #${idx + 1} agar tidak di-skip...`);
        await sleep(6000);
      }
    }

    return account;
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total waktu: ${elapsed}s`);
  printSummary(results);
}

main().catch(err => {
  console.error('\n❌ FATAL:', err.message);
  process.exit(1);
});

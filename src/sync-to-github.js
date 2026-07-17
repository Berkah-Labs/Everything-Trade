#!/usr/bin/env node
/**
 * EVERYTHING TRADE — MULTI-VPS SYNC & GITHUB BACKUP
 *
 * Pulls accounts from VPS 1 & VPS 2, merges with VPS 3, saves atomic, pushes to GitHub.
 * Usage: node src/sync-to-github.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readAccounts, saveAccounts, ACCOUNTS_FILE } from './register.js';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fetchRemoteAccounts(host, label) {
  try {
    console.log('📡 Fetching accounts from ' + label + ' (' + host + ')...');
    const out = execSync('ssh -o ConnectTimeout=10 root@' + host + ' cat /root/everything-trade/everything-trade-auto-v2/data/accounts.json', { encoding: 'utf8' });
    const data = JSON.parse(out);
    console.log('   ✅ Fetched ' + data.length + ' accounts from ' + label);
    return data;
  } catch (e) {
    console.error('   ⚠️ Failed to fetch from ' + label + ': ' + e.message);
    return [];
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🔄 EVERYTHING TRADE — MULTI-VPS SYNC & GITHUB BACKUP');
  console.log('══════════════════════════════════════════════════════════\n');

  const localAcc = readAccounts();
  console.log('🏠 Local accounts on VPS 3: ' + localAcc.length);

  const vps1Acc = fetchRemoteAccounts('168.144.142.160', 'VPS 1 (Wormcup)');
  const vps2Acc = fetchRemoteAccounts('129.212.233.185', 'VPS 2 (Hypermet)');

  // Merge unique by email or address
  const map = new Map();
  const allList = [...localAcc, ...vps1Acc, ...vps2Acc];

  for (const acc of allList) {
    const key = acc.address ? acc.address.toLowerCase() : acc.email;
    if (key && !map.has(key)) {
      map.set(key, acc);
    } else if (key && map.has(key)) {
      const existing = map.get(key);
      if (acc.token && !existing.token) {
        map.set(key, acc);
      }
    }
  }

  const merged = Array.from(map.values());
  console.log('\n🔗 Consolidated Total Unique Accounts: ' + merged.length + ' (Added ' + (merged.length - localAcc.length) + ' remote accounts)');

  saveAccounts(merged);
  console.log('💾 Merged accounts saved to local data/accounts.json');

  // Push to GitHub
  try {
    console.log('\n🐙 Pushing consolidated accounts to GitHub (Berkah-Labs/Everything-Trade)...');
    const repoDir = path.resolve(__dirname, '..');
    execSync('git -C "' + repoDir + '" add data/accounts.json', { stdio: 'inherit' });
    try {
      execSync('git -C "' + repoDir + '" commit -m "chore(auto-sync): consolidated ' + merged.length + ' accounts from 3 VPS [skip ci]"', { stdio: 'pipe' });
    } catch (e) {
      console.log('   ℹ️ No changes in accounts.json to commit.');
      return;
    }
    execSync('git -C "' + repoDir + '" push origin main', { stdio: 'inherit' });
    console.log('   ✅ Successfully pushed consolidated accounts to GitHub!');
  } catch (err) {
    console.error('   ❌ GitHub sync error: ' + err.message);
  }
}

main().catch(err => {
  console.error('\n❌ FATAL: ' + err.message);
  process.exit(1);
});

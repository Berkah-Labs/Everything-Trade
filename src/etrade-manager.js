#!/usr/bin/env node
/**
 * EVERYTHING TRADE — TELEGRAM BOT MANAGER & 1-MINUTE LIVE REPORTER
 */
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_TOKEN = '8639857410:AAFmwXFE7nZHy34ADH2j2RtcAEKpDMvc2hw';
const ADMIN_ID = 1475537552;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

const STATE_FILE = path.resolve(__dirname, '../data/manager-state.json');
let state = { mode: 'dashboard', dashboardMsgId: null };
try {
  if (fs.existsSync(STATE_FILE)) state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} catch (e) {}

function saveState() {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch (e) {}
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function tgApi(method, body) {
  try {
    const res = await fetch(`${BASE_URL}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API error (${method}):`, err.message);
    return { ok: false };
  }
}

async function setupCommands() {
  await tgApi('setMyCommands', {
    commands: [
      { command: 'status', description: '📊 Cek status & jumlah akun live di 3 VPS' },
      { command: 'sync', description: '🔄 Sync akun dari 3 VPS & backup ke GitHub' },
      { command: 'checkin', description: '🎯 Jalankan daily checkin sekarang' },
      { command: 'pause', description: '⏸️ Pause auto-registrasi di 3 VPS' },
      { command: 'resume', description: '▶️ Resume auto-registrasi di 3 VPS' },
      { command: 'mode', description: '⚙️ Toggle mode laporan (Dashboard vs Pesan Baru)' }
    ]
  });
}

function getRemoteStats(host, label) {
  try {
    const out = execSync(`ssh -o ConnectTimeout=6 root@${host} "cat /root/everything-trade/everything-trade-auto-v2/data/accounts.json"`, { encoding: 'utf8' });
    const accounts = JSON.parse(out);
    const active = execSync(`ssh -o ConnectTimeout=6 root@${host} "systemctl is-active everything-register.service"`, { encoding: 'utf8' }).trim() === 'active';
    return { label, count: accounts.length, active, accounts };
  } catch (e) {
    return { label, count: 0, active: false, error: e.message, accounts: [] };
  }
}

function getLocalStats() {
  try {
    const file = path.resolve(__dirname, '../data/accounts.json');
    let accounts = [];
    if (fs.existsSync(file)) accounts = JSON.parse(fs.readFileSync(file, 'utf8'));
    const active = execSync('systemctl is-active everything-register.service', { encoding: 'utf8' }).trim() === 'active';
    return { label: 'VPS 3 (Failover)', count: accounts.length, active, accounts };
  } catch (e) {
    return { label: 'VPS 3 (Failover)', count: 0, active: false, error: e.message, accounts: [] };
  }
}

function allListOrUnique(allList, uniqueMap) {
  for (const acc of allList) {
    const key = acc.address ? acc.address.toLowerCase() : acc.email;
    if (key && !uniqueMap.has(key)) uniqueMap.set(key, acc);
  }
  return Array.from(uniqueMap.values());
}

function calculateEstimatedE(accountsList) {
  let eToken = 0;
  for (const acc of accountsList) {
    eToken += 2;
    if (acc.createdAt) {
      const diffTime = Math.abs(new Date() - new Date(acc.createdAt));
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) eToken += (diffDays * 2);
    }
  }
  return eToken;
}

const realBalances = { hidnan: null, azzura: null, sansan: null, raihanadhe: null, zurzur: null };

async function getRealBalance(token) {
  try {
    const res = await fetch('https://hp-sbt.everything.co/api/etoken/reward/balance', {
      method: 'GET',
      headers: { 'channel': 'minApp', 'device-type': 'web', 'platformtype': 'web', 'token': token, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.code === '0' && data.data && data.data.balance !== undefined) {
      return data.data; // { balance: 262, usdValue: 92.49 }
    }
  } catch (e) {}
  return null;
}

async function generateStatusText() {
  const vps1 = getRemoteStats('168.144.142.160', 'VPS 1 (Wormcup)');
  const vps2 = getRemoteStats('129.212.233.185', 'VPS 2 (Hypermet)');
  const vps3 = getLocalStats();

  const allAccounts = [...vps1.accounts, ...vps2.accounts, ...vps3.accounts];
  const uniqueMap = new Map();
  const reffStats = {
    hidnan: { count: 0, accounts: [] },
    azzura: { count: 0, accounts: [] },
    sansan: { count: 0, accounts: [] },
    raihanadhe: { count: 0, accounts: [] },
    zurzur: { count: 0, accounts: [] },
    other: { count: 0, accounts: [] }
  };

  for (const acc of allListOrUnique(allAccounts, uniqueMap)) {
    const r = acc.referrer ? acc.referrer.toLowerCase() : 'hidnan';
    if (r in reffStats) {
      reffStats[r].count++;
      reffStats[r].accounts.push(acc);
    } else {
      reffStats.other.count++;
      reffStats.other.accounts.push(acc);
    }
  }

  let mainTokens = {};
  try {
    const tokenFile = path.resolve(__dirname, '../data/main-tokens.json');
    if (fs.existsSync(tokenFile)) mainTokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
  } catch(e) {}

  for (const reff of Object.keys(reffStats)) {
    if (mainTokens[reff]) {
      const realData = await getRealBalance(mainTokens[reff]);
      if (realData) realBalances[reff] = realData;
    }
  }

  const statusIcon = (active) => active ? '🟢 Run' : '🔴 Off';

  let msg = `📊 <b>EVERYTHING TRADE — LIVE 3 VPS DASHBOARD</b>\n`;
  msg += `🕒 <code>${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC</code>\n\n`;

  msg += `🖥️ <b>Pekerja & Output Akun per VPS:</b>\n`;
  msg += `• <b>${vps1.label}:</b> <code>${vps1.count} akun</code> [${statusIcon(vps1.active)}]\n`;
  msg += `• <b>${vps2.label}:</b> <code>${vps2.count} akun</code> [${statusIcon(vps2.active)}]\n`;
  msg += `• <b>${vps3.label}:</b> <code>${vps3.count} akun</code> [${statusIcon(vps3.active)}]\n\n`;

  msg += `📈 <b>Total Akun Reff Berhasil Dibuat:</b> <code>${uniqueMap.size} Akun</code>\n\n`;

  msg += `💰 <b>Total Saldo $E Akun Utama:</b>\n`;

  for (const reff of ['hidnan', 'azzura', 'sansan', 'raihanadhe', 'zurzur']) {
    let balanceDisplay = '';
    if (realBalances[reff]) {
      balanceDisplay = `<b>${realBalances[reff].balance.toLocaleString('id-ID')} $E</b> <i>(~$${realBalances[reff].usdValue.toFixed(2)})</i>`;
    } else {
      balanceDisplay = `<b>${calculateEstimatedE(reffStats[reff].accounts).toLocaleString("id-ID")} $E</b>`;
    }
    msg += `├ <code>${reff.padEnd(10)}</code> : ${balanceDisplay}\n`;
  }
  msg += `\n`;

  msg += `⚙️ <i>Mode: ${state.mode === 'dashboard' ? 'Live Dashboard Pinned' : 'Pesan Baru Tiap Menit'}</i>\n`;
  msg += `👉 <i>Ketik /status, /sync, /checkin, /pause, /resume, atau /mode</i>`;

  return msg;
}

async function sendMinuteReport() {
  const text = await generateStatusText();

  if (state.mode === 'dashboard' && state.dashboardMsgId) {
    const res = await tgApi('editMessageText', {
      chat_id: ADMIN_ID,
      message_id: state.dashboardMsgId,
      text: text,
      parse_mode: 'HTML'
    });
    if (!res.ok) {
      const newRes = await tgApi('sendMessage', { chat_id: ADMIN_ID, text, parse_mode: 'HTML' });
      if (newRes.ok) {
        state.dashboardMsgId = newRes.result.message_id;
        saveState();
      }
    }
  } else {
    const res = await tgApi('sendMessage', { chat_id: ADMIN_ID, text, parse_mode: 'HTML' });
    if (res.ok && state.mode === 'dashboard') {
      state.dashboardMsgId = res.result.message_id;
      saveState();
    }
  }
}

let lastUpdateId = 0;
async function pollUpdates() {
  while (true) {
    try {
      const res = await tgApi('getUpdates', { offset: lastUpdateId + 1, timeout: 30 });
      if (res.ok && res.result && res.result.length > 0) {
        for (const update of res.result) {
          lastUpdateId = update.update_id;
          if (update.message && update.message.text && update.message.from.id === ADMIN_ID) {
            const cmd = update.message.text.trim().split(' ')[0].toLowerCase();
            const chatId = update.message.chat.id;

            if (cmd === '/status') {
              const text = await generateStatusText();
              await tgApi('sendMessage', { chat_id: chatId, text: text, parse_mode: 'HTML' });
            }
            else if (cmd === '/sync') {
              await tgApi('sendMessage', { chat_id: chatId, text: '⏳ Memulai sinkronisasi dari 3 VPS ke GitHub...' });
              try {
                const out = execSync('node src/sync-to-github.js', { encoding: 'utf8' });
                await tgApi('sendMessage', { chat_id: chatId, text: `✅ <b>Sync GitHub Berhasil!</b>\n<pre>${out.substring(out.length - 800)}</pre>`, parse_mode: 'HTML' });
              } catch (e) {
                await tgApi('sendMessage', { chat_id: chatId, text: `❌ <b>Sync Gagal:</b> ${e.message}` });
              }
            }
            else if (cmd === '/checkin') {
              await tgApi('sendMessage', { chat_id: chatId, text: '⏳ Menjalankan manual daily check-in sekarang...' });
              try {
                const out = execSync('node src/checkin.js', { encoding: 'utf8' });
                await tgApi('sendMessage', { chat_id: chatId, text: `✅ <b>Check-in Selesai!</b>\n<pre>${out.substring(out.length - 800)}</pre>`, parse_mode: 'HTML' });
              } catch (e) {
                await tgApi('sendMessage', { chat_id: chatId, text: `❌ <b>Check-in Error:</b> ${e.message}` });
              }
            }
            else if (cmd === '/pause') {
              await tgApi('sendMessage', { chat_id: chatId, text: '⏸️ Mematikan auto-registrasi di 3 VPS...' });
              execSync('ssh -o ConnectTimeout=5 root@168.144.142.160 "systemctl stop everything-register.service" || true');
              execSync('ssh -o ConnectTimeout=5 root@129.212.233.185 "systemctl stop everything-register.service" || true');
              execSync('systemctl stop everything-register.service || true');
              await tgApi('sendMessage', { chat_id: chatId, text: '✅ Auto-registrasi di seluruh 3 VPS telah di-pause!' });
            }
            else if (cmd === '/resume') {
              await tgApi('sendMessage', { chat_id: chatId, text: '▶️ Menyala kembali auto-registrasi di 3 VPS...' });
              execSync('ssh -o ConnectTimeout=5 root@168.144.142.160 "systemctl start everything-register.service" || true');
              execSync('ssh -o ConnectTimeout=5 root@129.212.233.185 "systemctl start everything-register.service" || true');
              execSync('systemctl start everything-register.service || true');
              await tgApi('sendMessage', { chat_id: chatId, text: '🚀 Auto-registrasi di seluruh 3 VPS aktif kembali!' });
            }
            else if (cmd === '/mode') {
              state.mode = state.mode === 'dashboard' ? 'messages' : 'dashboard';
              state.dashboardMsgId = null;
              saveState();
              await tgApi('sendMessage', { chat_id: chatId, text: `⚙️ Mode laporan berhasil diubah ke: <b>${state.mode === 'dashboard' ? 'Live Dashboard Pinned (Edit Tiap Menit)' : 'Pesan Baru Tiap Menit'}</b>`, parse_mode: 'HTML' });
            }
          }
        }
      }
    } catch (err) {
      await sleep(5000);
    }
  }
}

async function main() {
  await setupCommands();
  await sendMinuteReport();
  setInterval(sendMinuteReport, 60000);
  pollUpdates();
}

main();

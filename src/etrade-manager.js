#!/usr/bin/env node
/**
 * EVERYTHING TRADE — TELEGRAM BOT MANAGER & 1-MINUTE LIVE REPORTER
 *
 * Bot Token: 8639857410:AAFmwXFE7nZHy34ADH2j2RtcAEKpDMvc2hw
 * Admin ID : 1475537552
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
  console.log('✅ Telegram bot menu commands configured!');
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

function generateStatusText() {
  const vps1 = getRemoteStats('168.144.142.160', 'VPS 1 (Wormcup)');
  const vps2 = getRemoteStats('129.212.233.185', 'VPS 2 (Hypermet)');
  const vps3 = getLocalStats();

  const allAccounts = [...vps1.accounts, ...vps2.accounts, ...vps3.accounts];
  const uniqueMap = new Map();
  const reffCounts = { hidnan: 0, azzura: 0, sansan: 0, raihanadhe: 0, zurzur: 0, other: 0 };

  for (const acc of allListOrUnique(allAccounts, uniqueMap)) {
    const r = acc.referrer ? acc.referrer.toLowerCase() : 'hidnan';
    if (r in reffCounts) reffCounts[r]++;
    else reffCounts.other++;
  }

  const statusIcon = (active) => active ? '🟢 Running' : '🔴 Paused';

  let msg = `📊 <b>EVERYTHING TRADE — LIVE 3 VPS DASHBOARD</b>\n`;
  msg += `🕒 <code>${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC</code>\n\n`;

  msg += `🖥️ <b>Status & Output Akun per VPS:</b>\n`;
  msg += `• <b>${vps1.label}:</b> <code>${vps1.count} akun</code> [${statusIcon(vps1.active)}]\n`;
  msg += `• <b>${vps2.label}:</b> <code>${vps2.count} akun</code> [${statusIcon(vps2.active)}]\n`;
  msg += `• <b>${vps3.label}:</b> <code>${vps3.count} akun</code> [${statusIcon(vps3.active)}]\n\n`;

  msg += `📈 <b>Total Akun Terkonsolidasi:</b> <code>${uniqueMap.size} Akun Unik</code>\n\n`;

  msg += `👥 <b>Distribusi 5 Referal Utama:</b>\n`;
  msg += `├ <code>hidnan</code>      : <b>${reffCounts.hidnan}</b> akun\n`;
  msg += `├ <code>azzura</code>      : <b>${reffCounts.azzura}</b> akun\n`;
  msg += `├ <code>sansan</code>      : <b>${reffCounts.sansan}</b> akun\n`;
  msg += `├ <code>raihanadhe</code>  : <b>${reffCounts.raihanadhe}</b> akun\n`;
  msg += `└ <code>zurzur</code>      : <b>${reffCounts.zurzur}</b> akun\n\n`;

  msg += `⚙️ <i>Mode Laporan: ${state.mode === 'dashboard' ? 'Live Dashboard Pinned (Edit Tiap Menit)' : 'Pesan Baru Tiap Menit'}</i>\n`;
  msg += `👉 <i>Ketik /status, /sync, /checkin, /pause, /resume, atau /mode</i>`;

  return msg;
}

async function sendMinuteReport() {
  console.log('📤 Generating 1-minute report across 3 VPS...');
  const text = generateStatusText();

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

// ─── Polling Listener ───

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
              await tgApi('sendMessage', { chat_id: chatId, text: generateStatusText(), parse_mode: 'HTML' });
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
            else {
              await tgApi('sendMessage', { chat_id: chatId, text: '🤖 Perintah tidak dikenal. Cek menu di kiri bawah atau ketik /status, /sync, /checkin, /pause, /resume, /mode.' });
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

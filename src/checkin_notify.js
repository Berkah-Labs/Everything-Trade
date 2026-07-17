import fetch from 'node-fetch';
import { Wallet } from 'ethers';
import { readAccounts } from './register.js';

const VPS_NAME = process.env.VPS_NAME || 'VPS';
const BOT_TOKEN = '8639857410:AAFmwXFE7nZHy34ADH2j2RtcAEKpDMvc2hw';
const CHAT_ID = '1475537552';
const BASE = 'https://hp-sbt.everything.co/api';
const CONCURRENCY = 3;
const DELAY_BETWEEN_BATCH = 1500; // Santai anti timeout/rate limit

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

async function sendTg(text, messageId = null) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${messageId ? 'editMessageText' : 'sendMessage'}`;
    const body = {
      chat_id: CHAT_ID,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (messageId) body.message_id = messageId;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok) {
      return messageId || data.result.message_id;
    }
  } catch (e) {
    console.error('Tg error:', e.message);
  }
  return messageId;
}

async function doCheckin(account) {
  try {
    const wallet = new Wallet(account.privateKey);
    const msgRes = await fetch(BASE + '/web3/getMessage', {
      method: 'POST', headers: HEADERS, body: JSON.stringify({ walletAddress: wallet.address })
    }).then(r => r.json());
    if (msgRes.code !== '0') throw new Error(`getMessage: ${msgRes.msg || 'Gagal'}`);

    const message = msgRes.data.message;
    const signature = await wallet.signMessage(message);

    const loginRes = await fetch(BASE + '/web3/login', {
      method: 'POST', headers: HEADERS, body: JSON.stringify({ walletAddress: wallet.address, signature, message })
    }).then(r => r.json());
    if (loginRes.code !== '0') throw new Error(`login: ${loginRes.msg || 'Gagal'}`);

    const token = loginRes.data.token;

    const res = await fetch(BASE + '/etoken/daily-checkin', {
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
    const data = await res.json();

    if (data.code === '0') {
      return { success: true, reward: data.data || 'Success' };
    } else {
      const msg = data.msg || 'Already checked in / Failed';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('sudah') || data.code === '10001') {
        return { success: true, reward: 'Already Checked In' };
      }
      return { success: false, msg };
    }
  } catch (e) {
    return { success: false, msg: e.message };
  }
}

async function runLoop() {
  let tgMsgId = null;
  const allAccounts = readAccounts();
  const validAccounts = allAccounts.filter(a => a.enabled && a.privateKey);

  if (validAccounts.length === 0) {
    console.log('Tidak ada akun valid.');
    return;
  }

  let processed = 0;
  let success = 0;
  let failed = 0;
  let startTime = Date.now();

  const getReportText = (isFinal = false) => {
    const elapsedMins = ((Date.now() - startTime) / 60000).toFixed(1);
    const progressPct = ((processed / validAccounts.length) * 100).toFixed(1);
    return `📊 <b>LAPORAN DAILY CHECK-IN ETRADE [${VPS_NAME}]</b> ${isFinal ? '✅ <b>(SELESAI)</b>' : '⏳ <b>(PROGRESS)</b>'}

👥 <b>Total Akun VPS:</b> ${validAccounts.length}
📈 <b>Progress:</b> ${processed}/${validAccounts.length} (${progressPct}%)
✨ <b>Berhasil Check-in:</b> ${success}
❌ <b>Gagal:</b> ${failed}
⏱ <b>Waktu Berjalan:</b> ${elapsedMins} menit

<i>${isFinal ? 'Semua akun di ' + VPS_NAME + ' selesai check-in harian.' : 'Pesan ini diperbarui otomatis setiap 10 akun berhasil check-in.'}</i>`;
  };

  tgMsgId = await sendTg(getReportText(false));

  let index = 0;
  const workers = Array(CONCURRENCY).fill(0).map(async () => {
    while (index < validAccounts.length) {
      const currentIndex = index++;
      const acc = validAccounts[currentIndex];

      const res = await doCheckin(acc);
      processed++;
      if (res.success) {
        success++;
        if (success % 10 === 0 && tgMsgId) {
          await sendTg(getReportText(false), tgMsgId);
        }
      } else {
        failed++;
      }

      console.log(`[${processed}/${validAccounts.length}] ${acc.nickname || acc.address.slice(0,8)} -> ${res.success ? 'SUCCESS' : 'FAILED: ' + res.msg}`);
      await sleep(DELAY_BETWEEN_BATCH);
    }
  });

  await Promise.all(workers);
  await sendTg(getReportText(true), tgMsgId);
  console.log('Daily check-in completed for ' + VPS_NAME);
}

runLoop().catch(console.error);

/**
 * EXPLORE: Session Injection Feasibility Test
 *
 * Tujuan: Verifikasi apakah API Everything Trade bisa diakses
 * tanpa browser — cukup dengan session cookie yang kita manage manual.
 *
 * Approach:
 * 1. Coba direct call ke setiap endpoint (session kosong)
 * 2. Coba dengan cookie dari response sebelumnya
 * 3. Coba dengan cookie yang dikopi dari DevTools browser
 * 4. Bandingkan response — mana yang butuh session vs tidak
 */

import { SessionClient } from './session-client.js';
import { generateWallet } from './wallet.js';
import { EmailClient } from './email-client.js';

const session = new SessionClient();
const wallet = generateWallet();
const email = new EmailClient();

function randomNickname() {
  const names = ['alex', 'chloe', 'marco', 'nicolas', 'kenji', 'viktor', 'oliver', 'liam', 'mia', 'elena', 'sota', 'dimas', 'kevin', 'rayhan'];
  const randomStr = (len) => Array.from({ length: len }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
  return names[Math.floor(Math.random() * names.length)] + randomStr(4);
}

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  EVERYTHING TRADE — SESSION INJECTION EXPLORATION');
  console.log('══════════════════════════════════════════════════════════\n');

  const reffCode = process.argv[2] || 'hidnan';
  const nickname = randomNickname();

  console.log(`Wallet: ${wallet.address}`);
  console.log(`Referral: ${reffCode}`);
  console.log(`Nickname: ${nickname}\n`);

  // ═══════════════════════════════════════════════════════════════
  // TEST A: Direct call — session kosong
  // ═══════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  TEST A: DIRECT API (TANPA SESSION)         ║');
  console.log('╚══════════════════════════════════════════════╝');

  let result;

  // A1: getMessage
  result = await session.post('/web3/getMessage', {
    walletAddress: wallet.address,
  });
  console.log(`   → Challenge message diterima: ${result.data?.message ? '✅ YES' : '❌ NO'}`);

  if (!result.data?.message) {
    console.log('\n❌ Gagal di getMessage — API mungkin beda domain atau butuh header lain.');
    console.log('   Coba test dengan cookie dari browser...\n');
    await testWithBrowserCookies();
    return;
  }

  const challengeMessage = result.data.message;

  // A2: login (sign message)
  const signature = await wallet.signMessage(challengeMessage);
  result = await session.post('/web3/login', {
    walletAddress: wallet.address,
    signature,
    message: challengeMessage,
  });
  console.log(`   → Login response code: ${result.data.code} — ${result.data.msg || ''}`);
  const isPreReg = result.data.code === '400104';
  console.log(`   → Pre-registration mode: ${isPreReg ? '✅ YES (expected)' : '⚠️ NO — check response'}`);

  // ═══════════════════════════════════════════════════════════════
  // TEST B: Email generation + checkExit
  // ═══════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  TEST B: CHECK EXIT + EMAIL                 ║');
  console.log('╚══════════════════════════════════════════════╝');

  // Buat email sementara
  const mail = await email.createInbox();

  // checkExit — ini WAJIB sebelum sendSmsCode (HANDOVER report)
  result = await session.post('/app/user/checkExit', {
    mobileNo: mail.email,
    loginType: 102,
  });
  console.log(`   → checkExit code: ${result.data.code}`);
  console.log(`   → canSms: ${result.data.data?.canSms ?? '❌ NOT FOUND'}`);

  if (result.data.data?.canSms !== true) {
    console.log('   ⚠️  checkExit tidak mengembalikan canSms:true');
    console.log('      Ini bisa berarti session tidak terdeteksi oleh server.');
    console.log('      Coba inspect cookie dan header response...');
    session.dumpCookies();
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST C: Geetest init
  // ═══════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  TEST C: GEETEST INIT                       ║');
  console.log('╚══════════════════════════════════════════════╝');

  result = await session.post('/code/init?loginFlag=2&t=' + Date.now(), {});
  const hasGt = result.data?.data?.gt ? true : false;
  const isOffline = result.data?.data?.success === 0;
  const challengeLen = result.data?.data?.challenge?.length || 0;

  console.log(`   → GT key: ${hasGt ? '✅ YES' : '❌ NO'}`);
  console.log(`   → Offline mode: ${isOffline ? '✅ YES' : '❌ NO'}`);
  console.log(`   → Challenge length: ${challengeLen} chars`);
  console.log(`   → Data: ${JSON.stringify(result.data?.data || result.data).substring(0, 200)}`);

  if (hasGt && isOffline && challengeLen === 32) {
    console.log('   ⚡ Geetest offline mode confirmed — perlu +"bp" suffix!');
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST D: Coba sendSmsCode — dengan data dummy
  // ═══════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  TEST D: SMS CODE (DUMMY)                   ║');
  console.log('╚══════════════════════════════════════════════╝');

  if (hasGt) {
    const gt = result.data.data.gt;
    const challenge = result.data.data.challenge;

    // Coba kirim dengan secondValidateBO kosong — untuk test
    // apakah server butuh captcha solve dulu, atau cukup session
    result = await session.post('/app/user/sendSmsCode', {
      verifyCodeType: 4,
      bizType: 1,
      mobileNo: mail.email,
      secondValidateBO: {
        challenge: challenge + 'bp',
        validate: 'dummy_validate',
        seccode: 'dummy_seccode|jordan',
      },
    });
    console.log(`   → sendSmsCode result: code=${result.data.code}, msg=${(result.data.msg || '').substring(0, 100)}`);
    console.log(`   → Status: ${result.data.code === '0' ? '✅ OTP TERKIRIM!' : '❌ Gagal'}`);

    if (result.data.code === '0') {
      console.log('\n🎉 SESSION INJECTION WORKING!');
      console.log('   Server menerima request tanpa browser!');
    } else if (result.data.code === '400') {
      console.log('   ⚠️ 400 Illegal Operation — kemungkinan session tidak valid');
      console.log('   ➡️  Butuh cookie dari browser real');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  EXPLORATION COMPLETE                       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('\n📋 Cookie Jar state:');
  session.dumpCookies();
}

async function testWithBrowserCookies() {
  console.log('\n⚡=== TEST WITH BROWSER COOKIES ===⚡');
  console.log('\n📌 Cara pakai:');
  console.log('   1. Buka https://webapp.everything.co/dapp di browser biasa');
  console.log('   2. Buka DevTools → Application → Cookies → https://hp-sbt.everything.co');
  console.log('   3. Copy value JSESSIONID dan cookie lain');
  console.log('');
  console.log('   Lalu jalankan ulang:');
  console.log('   node src/register-flow.js --cookie "JSESSIONID=xxx; ..."');
}

main().catch(console.error);

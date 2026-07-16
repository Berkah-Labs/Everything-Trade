/**
 * EVERYTHING TRADE — SINGLE REGISTRATION CLI
 *
 * Thin wrapper around register() from register.js.
 * Usage: node src/register-flow.js [referralCode]
 */
import { register, readAccounts, saveAccounts } from './register.js';

const reffCode = process.argv[2] || 'hidnan';

console.log('══════════════════════════════════════════════════════════');
console.log('  EVERYTHING TRADE — AUTO REGISTRATION (No Browser)');
console.log('══════════════════════════════════════════════════════════\n');

register(reffCode).then(account => {
  const all = readAccounts();
  all.push(account);
  saveAccounts(all);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  ✅ SUMMARY:');
  console.log(`  📧 Email:    ${account.email}`);
  console.log(`  👛 Address:  ${account.address}`);
  console.log(`  🔑 PrivKey:  ${account.privateKey}`);
  console.log(`  🏷️  Nick:     ${account.nickname}`);
  console.log(`  💾 Saved to data/accounts.json`);
  console.log('══════════════════════════════════════════════════════════');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ ERROR:', err.message);
  process.exit(1);
});

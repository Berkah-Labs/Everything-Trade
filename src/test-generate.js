import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We duplicate calculateEstimatedE logic here to test it
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

try {
    const file = path.resolve(__dirname, '../data/accounts.json');
    let accounts = JSON.parse(readFileSync(file, 'utf8'));
    console.log(calculateEstimatedE(accounts));
} catch(e) { console.log(e); }

import fetch from 'node-fetch';
const TOKEN = 'AlJ+gFSuRfrrdvmb/Tkk7FxOHoiqltjzZWU1POqIG5Q4V6DDC/WbN6TgQbzjpG1sBGhVewodgNOLWpH9yIjBxN8mBLsfbS1EdTAhXV0EFt0dV0IezLVHcISfBNoNXvaIfsSBBJnyrBvnwIPnPjpk5k/0VgEg46TlYgm12oGAe6ONe9F7zBpe/BL3q0DM7pnJ239ee5J8xNRZ4I8vK3m88w==';
const BASE = 'https://hp-sbt.everything.co/api';
const HEADERS = {
  'channel': 'minApp',
  'device-type': 'web',
  'platformtype': 'web',
  'token': TOKEN,
  'Content-Type': 'application/json'
};

async function testApi() {
  try {
    const res = await fetch(BASE + '/etoken/reward/balance', { method: 'POST', headers: HEADERS, body: '{}' });
    const data = await res.json();
    console.log('POST /etoken/reward/balance =>', JSON.stringify(data, null, 2));
  } catch(e) {}
}

testApi();

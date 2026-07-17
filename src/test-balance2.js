import fetch from 'node-fetch';
const TOKEN = 'AlJ+gFSuRfrrdvmb/Tkk7FxOHoiqltjzZWU1POqIG5Q4V6DDC/WbN6TgQbzjpG1sTBPKht0OtDUNLCcjeIHCJ9FfVv2VZ+U7Q4xcT3DxYe7lpPS9hBkxzn/hGoJOwVSXFKPOiSrT/pI5D6/qV4cBqVRDNf277nQzDx23gP/iulwNxCTNzGhl1HICRCeiTpG4grgmB53zx5BQpStCcVggeg==';
const BASE = 'https://hp-sbt.everything.co/api';
const HEADERS = { 'channel': 'minApp', 'device-type': 'web', 'platformtype': 'web', 'token': TOKEN };

async function testApi() {
  try {
    const res = await fetch(BASE + '/etoken/reward/balance', { method: 'GET', headers: HEADERS });
    const data = await res.json();
    console.log('GET /etoken/reward/balance =>', JSON.stringify(data, null, 2));
  } catch(e) {}
}

testApi();

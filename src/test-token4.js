import fetch from 'node-fetch';
const TOKEN = 'AlJ+gFSuRfrrdvmb/Tkk7FxOHoiqltjzZWU1POqIG5Q4V6DDC/WbN6TgQbzjpG1sTBPKht0OtDUNLCcjeIHCJ9FfVv2VZ+U7Q4xcT3DxYe7lpPS9hBkxzn/hGoJOwVSXFKPOiSrT/pI5D6/qV4cBqVRDNf277nQzDx23gP/iulwNxCTNzGhl1HICRCeiTpG4grgmB53zx5BQpStCcVggeg==';
const BASE = 'https://hp-sbt.everything.co/api';
const HEADERS = { 'channel': 'minApp', 'device-type': 'web', 'platformtype': 'web', 'token': TOKEN };

async function testApi(path) {
  try {
    const res = await fetch(BASE + path, { method: 'GET', headers: HEADERS });
    const data = await res.json();
    if (data.status !== 404) console.log(path, '=>', JSON.stringify(data).substring(0, 200));
  } catch(e) {}
}

testApi('/app/user/info');

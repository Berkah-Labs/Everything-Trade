import fetch from 'node-fetch';
const TOKEN = 'AlJ+gFSuRfrrdvmb/Tkk7FxOHoiqltjzZWU1POqIG5Q4V6DDC/WbN6TgQbzjpG1sTBPKht0OtDUNLCcjeIHCJ9FfVv2VZ+U7Q4xcT3DxYe7lpPS9hBkxzn/hGoJOwVSXFKPOiSrT/pI5D6/qV4cBqVRDNf277nQzDx23gP/iulwNxCTNzGhl1HICRCeiTpG4grgmB53zx5BQpStCcVggeg==';
const BASE = 'https://hp-sbt.everything.co/api';
const HEADERS = {
  'Content-Type': 'application/json',
  'channel': 'minApp',
  'device-name': 'telegram',
  'device-type': 'web',
  'platformtype': 'web',
  'edition': '1.0.0',
  'device-id': '206545132',
  'referer': 'https://webapp.everything.co/',
  'token': TOKEN
};

async function testApi(path, method) {
  try {
    const res = await fetch(BASE + path, { method, headers: HEADERS, body: method==='POST'?'{}':undefined });
    const data = await res.json();
    if (data.status !== 404) console.log(method, path, '=>', JSON.stringify(data).substring(0, 200));
  } catch(e) {}
}

async function run() {
  await testApi('/app/user/info', 'GET');
  await testApi('/app/user/asset/list', 'POST');
  await testApi('/app/user/get', 'GET');
  await testApi('/user/info', 'GET');
}
run();

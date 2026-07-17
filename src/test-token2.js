import fetch from 'node-fetch';
const TOKEN = 'AlJ+gFSuRfrrdvmb/Tkk7FxOHoiqltjzZWU1POqIG5Q4V6DDC/WbN6TgQbzjpG1s209P0G0xajVwtmKPkvhENERGUsSsW4rhObXmMpaumP2+tmVOv0+NOkE0PXAKu+jj1pR8+jHievPGgHKHsMING+v93iTFZSjzL4n1zxv1VbtkujjFdrkdcrW5ITk0ypyh7RTOmqYPGq7KqhkIK7pDsQ==';
const BASE = 'https://hp-sbt.everything.co/api';
const HEADERS = { 'Content-Type': 'application/json', 'channel': 'minApp', 'device-type': 'web', 'platformtype': 'web', 'token': TOKEN };

async function testApi(path) {
  try {
    const res = await fetch(BASE + path, { method: 'POST', headers: HEADERS, body: '{}' });
    const data = await res.json();
    if (data.status !== 404) console.log(path, '=>', JSON.stringify(data).substring(0, 200));
  } catch(e) {}
}

async function run() {
  await testApi('/etoken/balance');
  await testApi('/app/user/info');
  await testApi('/app/user/me');
  await testApi('/user/detail');
  await testApi('/web3/info');
}
run();

import fetch from 'node-fetch';
const BASE = 'https://hp-sbt.everything.co/api';
const HEADERS = { 'Content-Type': 'application/json', 'channel': 'minApp', 'device-type': 'web', 'platformtype': 'web' };

const endpoints = [
  '/user/login',
  '/auth/login',
  '/login',
  '/email/login'
];

async function testAll() {
  for (const path of endpoints) {
    try {
      const res = await fetch(BASE + path, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email: 'hidnan', password: 'Bakulkalem1' })
      });
      const data = await res.json();
      if (data.status !== 404) {
        console.log(path, 'FOUND!', JSON.stringify(data).substring(0, 200));
      }
    } catch(e) {}
  }
  console.log('Test completed.');
}
testAll();

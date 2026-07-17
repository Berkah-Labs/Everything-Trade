import fetch from 'node-fetch';

const TOKEN = 'AlJ+gFSuRfrrdvmb/Tkk7FxOHoiqltjzZWU1POqIG5Q4V6DDC/WbN6TgQbzjpG1s209P0G0xajVwtmKPkvhENERGUsSsW4rhObXmMpaumP2+tmVOv0+NOkE0PXAKu+jj1pR8+jHievPGgHKHsMING+v93iTFZSjzL4n1zxv1VbtkujjFdrkdcrW5ITk0ypyh7RTOmqYPGq7KqhkIK7pDsQ==';
const BASE = 'https://hp-sbt.everything.co/api';

const HEADERS = {
  'Content-Type': 'application/json',
  'channel': 'minApp',
  'device-name': 'telegram',
  'device-type': 'web',
  'platformtype': 'web',
  'edition': '1.0.0',
  'referer': 'https://webapp.everything.co/',
  'token': TOKEN
};

async function test() {
  console.log('Testing Token...');
  
  // Test 1: Check User Info / Asset
  try {
    const res = await fetch(BASE + '/app/user/asset/list', {
      method: 'POST',
      headers: HEADERS,
      body: '{}'
    });
    const data = await res.json();
    console.log('Asset List Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error 1:', e.message);
  }

  // Test 2: User Dashboard / Info
  try {
    const res = await fetch(BASE + '/worldcup/me/dashboard', {
      method: 'POST',
      headers: HEADERS,
      body: '{}'
    });
    const data = await res.json();
    console.log('\nDashboard Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error 2:', e.message);
  }

  // Test 3: Daily Task / Sign-in Status
  try {
    const res = await fetch(BASE + '/task/list', {
      method: 'POST',
      headers: HEADERS,
      body: '{}'
    });
    const data = await res.json();
    console.log('\nTask List Response:', JSON.stringify(data).substring(0, 150));
  } catch (e) {
    console.log('Error 3:', e.message);
  }
}

test();

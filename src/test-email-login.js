import fetch from 'node-fetch';
const BASE = 'https://hp-sbt.everything.co/api';
const HEADERS = { 'Content-Type': 'application/json', 'channel': 'minApp', 'device-type': 'web', 'platformtype': 'web' };

async function loginEmail(email, password) {
  console.log('Testing Email Login for:', email);
  try {
    const res = await fetch(BASE + '/app/user/login', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        loginType: 201, // Usually 201 or 101 for email/pass, testing general login payload
        account: email,
        password: password,
        mobileNo: email
      })
    });
    const data = await res.json();
    console.log('Login Response:', JSON.stringify(data, null, 2));
  } catch(e) {
    console.log('Error:', e.message);
  }
}

loginEmail('hidnan', 'Bakulkalem1');

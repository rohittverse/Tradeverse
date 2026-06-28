'use strict';

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

async function requireAuth(req, send) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    send(401, { error: 'Unauthorized: Missing token' });
    return null;
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const { getApps, initializeApp, cert } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    if (!getApps().length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      initializeApp({ credential: cert(serviceAccount) });
    }
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch (error) {
    console.error('Auth error:', error.message);
    send(401, { error: 'Unauthorized: Invalid token' });
    return null;
  }
}

module.exports = { parseBody, requireAuth };

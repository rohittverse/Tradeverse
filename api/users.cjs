'use strict';
const { requireAuth } = require('./_helpers.cjs');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq } = require('drizzle-orm');

function getDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const { users } = require('../src/db/schema.js');
  return { db: drizzle(pool), users };
}

module.exports = async function handler(req, res) {
  const send = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const user = await requireAuth(req, send);
  if (!user) return;

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    if (req.method === 'POST') {
      await pool.query(
        `INSERT INTO users (uid, email) VALUES ($1, $2)
         ON CONFLICT (uid) DO UPDATE SET email = $2`,
        [user.uid, user.email]
      );
      const result = await pool.query('SELECT * FROM users WHERE uid = $1', [user.uid]);
      await pool.end();
      return send(200, result.rows[0]);
    }

    if (req.method === 'GET') {
      const result = await pool.query('SELECT * FROM users WHERE uid = $1', [user.uid]);
      await pool.end();
      if (result.rows.length === 0) return send(404, { error: 'User not found' });
      return send(200, result.rows[0]);
    }

    await pool.end();
    return send(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Users error:', error.message);
    return send(500, { error: error.message });
  }
};

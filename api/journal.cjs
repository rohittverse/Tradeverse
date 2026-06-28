'use strict';
const { requireAuth, parseBody } = require('./_helpers.cjs');
const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  const send = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const user = await requireAuth(req, send);
  if (!user) return;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE uid = $1', [user.uid]);
    if (userResult.rows.length === 0) { await pool.end(); return send(404, { error: 'User not found' }); }
    const userId = userResult.rows[0].id;

    if (req.method === 'GET') {
      const result = await pool.query(
        'SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      await pool.end();
      return send(200, result.rows);
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const today = new Date().toISOString().split('T')[0];
      const result = await pool.query(
        `INSERT INTO journal_entries (user_id, trade_date, post_trade_review, emotions)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, today, body.notes || null, body.mood || null]
      );
      await pool.end();
      return send(200, result.rows[0]);
    }

    await pool.end();
    return send(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Journal error:', error.message);
    await pool.end();
    return send(500, { error: error.message });
  }
};

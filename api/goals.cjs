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
        'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      await pool.end();
      return send(200, result.rows);
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const result = await pool.query(
        `INSERT INTO goals (user_id, title, description, target_value, current_value, deadline, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          userId,
          body.title,
          body.description || null,
          body.targetValue || null,
          body.currentValue || 0,
          body.deadline || null,
          body.status || 'in_progress',
        ]
      );
      await pool.end();
      return send(200, result.rows[0]);
    }

    await pool.end();
    return send(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Goals error:', error.message);
    await pool.end();
    return send(500, { error: error.message });
  }
};

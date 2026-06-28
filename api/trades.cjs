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
        'SELECT * FROM trades WHERE user_id = $1 ORDER BY trade_date DESC',
        [userId]
      );
      await pool.end();
      return send(200, result.rows);
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const result = await pool.query(
        `INSERT INTO trades 
          (user_id, trade_date, asset, trade_type, entry_price, exit_price, lot_size, contract_size, quantity, leverage, position_value, used_margin, profit_loss, roi_percentage, notes, strategy, mistakes, emotions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        [
          userId,
          body.tradeDate,
          body.asset,
          body.tradeType,
          body.entryPrice,
          body.exitPrice || null,
          body.lotSize,
          body.contractSize,
          body.quantity,
          body.leverage,
          body.positionValue,
          body.usedMargin,
          body.profitLoss || null,
          body.roiPercentage || null,
          body.notes || null,
          body.strategy || null,
          body.mistakes || null,
          body.emotions || null,
        ]
      );
      await pool.end();
      return send(200, result.rows[0]);
    }

    await pool.end();
    return send(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Trades error:', error.message);
    await pool.end();
    return send(500, { error: error.message });
  }
};

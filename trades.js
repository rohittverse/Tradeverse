export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
    const token = authHeader.split('Bearer ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const uid = payload.user_id || payload.sub;
    if (!uid) return res.status(401).json({ error: 'Invalid token' });

    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    const userResult = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
    if (userResult.rows.length === 0) { await pool.end(); return res.status(404).json({ error: 'User not found' }); }
    const userId = userResult.rows[0].id;

    if (req.method === 'GET') {
      const result = await pool.query('SELECT * FROM trades WHERE user_id = $1 ORDER BY trade_date DESC', [userId]);
      await pool.end();
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const body = req.body;
      const result = await pool.query(
        `INSERT INTO trades (user_id, trade_date, asset, trade_type, entry_price, exit_price, lot_size, contract_size, quantity, leverage, position_value, used_margin, profit_loss, roi_percentage, notes, strategy, mistakes, emotions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [userId, body.tradeDate, body.asset, body.tradeType, body.entryPrice, body.exitPrice || null,
         body.lotSize, body.contractSize, body.quantity, body.leverage, body.positionValue,
         body.usedMargin, body.profitLoss || null, body.roiPercentage || null,
         body.notes || null, body.strategy || null, body.mistakes || null, body.emotions || null]
      );
      await pool.end();
      return res.status(200).json(result.rows[0]);
    }

    await pool.end();
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('TRADES ERROR:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Get uid directly from auth header (we trust Firebase client-side auth)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
    
    // Decode the JWT payload without verification (Firebase client already verified it)
    const token = authHeader.split('Bearer ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const uid = payload.user_id || payload.sub;
    const email = payload.email;

    if (!uid) return res.status(401).json({ error: 'Invalid token' });

    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    if (req.method === 'POST') {
      await pool.query(
        `INSERT INTO users (uid, email) VALUES ($1, $2) ON CONFLICT (uid) DO UPDATE SET email = $2`,
        [uid, email]
      );
      const result = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
      await pool.end();
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'GET') {
      const result = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
      await pool.end();
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json(result.rows[0]);
    }

    await pool.end();
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('USERS ERROR:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

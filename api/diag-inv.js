module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'env' }); return; }

  // Probe: list tables in GRANTT_DASH.src that start with 'inv' or 'doc'
  const sql = `SELECT TABLE_NAME FROM GRANTT_DASH.INFORMATION_SCHEMA.TABLES
               WHERE TABLE_SCHEMA = 'src'
                 AND (TABLE_NAME LIKE 'inv%' OR TABLE_NAME LIKE 'doc%' OR TABLE_NAME LIKE 'ven%')
               ORDER BY TABLE_NAME`;
  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 200 }),
    });
    const d = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(d);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};

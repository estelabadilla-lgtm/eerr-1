module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'env' }); return; }

  // Try to find the right inventory/sales table by probing common Softland names
  const tablas = ['invdocenc','invenc','bolfac','facenc','venenc','invdoc','cwfactven','cwinvdoc','invmovenc'];
  const sql = tablas.map(t =>
    `SELECT '${t}' AS t, COUNT(*) AS n FROM GRANTT_DASH.src.${t}`
  ).join(' UNION ALL ');
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

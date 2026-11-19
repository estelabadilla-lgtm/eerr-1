module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Config' }); return; }

  const sql = `
    SELECT TABLE_NAME
    FROM GRANTT_DASH.INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND (TABLE_NAME LIKE '%prod%' OR TABLE_NAME LIKE '%tprod%' OR TABLE_NAME LIKE '%articul%' OR TABLE_NAME LIKE '%item%')
    ORDER BY TABLE_NAME`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 50000 }),
    });
    if (!r.ok) { res.status(502).json({ error: `API ${r.status}` }); return; }
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ productos: data.filas, generado: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar' });
  }
};

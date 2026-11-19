module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Config' }); return; }

  const queries = {
    databases: `SELECT name FROM sys.databases ORDER BY name`,
    vendedores_grantt: `SELECT VenCod, VenDes FROM GRANTT_DASH.src.cwtvend ORDER BY VenCod`,
  };

  const run = async sql => {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 100 }),
    });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return r.json();
  };

  const results = {};
  for (const [k, sql] of Object.entries(queries)) {
    try { results[k] = await run(sql); } catch (e) { results[k] = { error: e.message }; }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(results);
};

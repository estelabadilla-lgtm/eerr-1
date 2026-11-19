module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan env vars' }); return; }

  const queries = {
    top_iw_costop: `SELECT TOP 5 * FROM GRANTT_DASH.src.iw_costop`,
    cols_iw_costop: `SELECT COLUMN_NAME, DATA_TYPE FROM GRANTT_DASH.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='iw_costop'`,
    top_iw_tprod: `SELECT TOP 5 * FROM GRANTT_DASH.src.iw_tprod`,
    cols_iw_tprod: `SELECT COLUMN_NAME, DATA_TYPE FROM GRANTT_DASH.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='iw_tprod'`,
  };

  const run = async sql => {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 10 }),
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

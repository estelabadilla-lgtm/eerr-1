module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan env vars' }); return; }

  const queries = {
    top_iw_costop: `SELECT TOP 10 * FROM GRANTT_DASH.src.iw_costop`,
    top_iw_tprod:  `SELECT TOP 10 * FROM GRANTT_DASH.src.iw_tprod`,
    top_iw_tsubgr: `SELECT TOP 5  * FROM GRANTT_DASH.src.iw_tsubgr`,
    top_iw_tgrupo: `SELECT TOP 5  * FROM GRANTT_DASH.src.iw_tgrupo`,
    join_prod_costo: `
      SELECT TOP 20
        p.CodProd, p.DesProd, p.UniMed,
        c.CodBod, c.CostoUlt, c.CostoProm, c.CostoEst,
        c.StkAct
      FROM GRANTT_DASH.src.iw_tprod p
      LEFT JOIN GRANTT_DASH.src.iw_costop c ON c.CodProd = p.CodProd
      WHERE p.Estado = 'A'
      ORDER BY p.CodProd`,
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

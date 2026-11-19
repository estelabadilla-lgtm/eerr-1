module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan env vars' }); return; }

  const queries = {
    vendedores: `SELECT VenCod, VenDes FROM GRANTT_DASH.src.cwtvend ORDER BY VenCod`,
    join_prod_costo: `
      SELECT TOP 30
        p.CodProd,
        LTRIM(RTRIM(p.DesProd)) AS DesProd,
        p.CodUMed,
        p.ValorUltCom AS costo_tprod,
        p.PrecioVta,
        p.CodGrupo,
        c.CostoUnitario AS costo_costop,
        c.Stock,
        c.Fecha AS fecha_costo
      FROM GRANTT_DASH.src.iw_tprod p
      LEFT JOIN (
        SELECT CodProd, CostoUnitario, Stock, Fecha,
               ROW_NUMBER() OVER (PARTITION BY CodProd ORDER BY Fecha DESC) AS rn
        FROM GRANTT_DASH.src.iw_costop
      ) c ON c.CodProd = p.CodProd AND c.rn = 1
      WHERE p.Inactivo = 0
        AND p.esParaVenta <> 0
        AND p.CodGrupo NOT IN ('OBSOL','BLOQ')
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

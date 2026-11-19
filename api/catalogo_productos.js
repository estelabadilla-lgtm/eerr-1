module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Config' }); return; }

  const sql = `
    SELECT
      LTRIM(RTRIM(p.CodProd)) AS sku,
      LTRIM(RTRIM(p.DesProd)) AS desc,
      COALESCE(NULLIF(LTRIM(RTRIM(COALESCE(p.CodUMed,''))), ''), 'UNI') AS umed,
      COALESCE(c.CostoUnitario, p.ValorUltCom, 0) AS costo,
      COALESCE(c.Stock, 0) AS stock,
      LTRIM(RTRIM(COALESCE(p.CodGrupo,''))) AS grupo
    FROM GRANTT_DASH.src.iw_tprod p
    LEFT JOIN (
      SELECT CodProd, CostoUnitario, Stock,
             ROW_NUMBER() OVER (PARTITION BY CodProd ORDER BY Fecha DESC) AS rn
      FROM GRANTT_DASH.src.iw_costop
    ) c ON c.CodProd = LTRIM(RTRIM(p.CodProd)) AND c.rn = 1
    WHERE p.Inactivo = 0
      AND p.esParaVenta <> 0
      AND LTRIM(RTRIM(COALESCE(p.CodGrupo,''))) NOT IN ('OBSOL','BLOQ')
      AND LTRIM(RTRIM(COALESCE(p.DesProd,''))) NOT IN ('','no usar')
    ORDER BY p.DesProd`;

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

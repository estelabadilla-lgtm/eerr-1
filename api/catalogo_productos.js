module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Config' }); return; }

  const sql = `
    SELECT
      LTRIM(RTRIM(p.CodProd)) AS sku,
      LTRIM(RTRIM(p.DesProd)) AS desc,
      COALESCE(LTRIM(RTRIM(p.CodUMed)),'UNI') AS umed,
      COALESCE(c.CostoUnitario, p.ValorUltCom, 0) AS costo,
      COALESCE(c.Stock, 0) AS stock,
      COALESCE(LTRIM(RTRIM(p.CodGrupo)),'') AS grupo
    FROM GRANTT_DASH.src.iw_tprod p
    OUTER APPLY (
      SELECT TOP 1 CostoUnitario, Stock
      FROM GRANTT_DASH.src.iw_costop x
      WHERE LTRIM(RTRIM(x.CodProd)) = LTRIM(RTRIM(p.CodProd))
      ORDER BY Fecha DESC
    ) c
    WHERE p.Inactivo = 0
      AND p.esParaVenta = 1
      AND LTRIM(RTRIM(COALESCE(p.DesProd,''))) <> ''
    ORDER BY p.DesProd`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 5000 }),
    });
    if (!r.ok) { res.status(502).json({ error: `API ${r.status}` }); return; }
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ productos: data.filas, generado: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar' });
  }
};

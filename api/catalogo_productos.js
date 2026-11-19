module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Config' }); return; }

  const sql = `
    SELECT TOP 2000
      LTRIM(RTRIM(CodProd)) AS sku,
      LTRIM(RTRIM(DesProd)) AS nombre,
      COALESCE(LTRIM(RTRIM(CodUMed)),'UNI') AS umed,
      COALESCE(ValorUltCom, 0) AS costo,
      0 AS stock,
      COALESCE(LTRIM(RTRIM(CodGrupo)),'') AS grupo
    FROM GRANTT_DASH.src.iw_tprod
    WHERE Inactivo = 0
      AND esParaVenta = 1
    ORDER BY DesProd`;

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

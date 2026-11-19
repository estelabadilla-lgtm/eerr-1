module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Config' }); return; }

  const sqlProd = `
    SELECT TOP 2000
      LTRIM(RTRIM(CodProd)) AS sku,
      LTRIM(RTRIM(DesProd)) AS nombre,
      COALESCE(LTRIM(RTRIM(CodUMed)),'UNI') AS umed,
      COALESCE(ValorUltCom, 0) AS costo,
      COALESCE(LTRIM(RTRIM(CodGrupo)),'') AS grupo
    FROM GRANTT_DASH.src.iw_tprod
    WHERE Inactivo = 0
    ORDER BY DesProd`;

  const sqlCosto = `
    SELECT LTRIM(RTRIM(CodProd)) AS sku, CostoUnitario AS costo, Stock AS stock
    FROM GRANTT_DASH.src.iw_costop c1
    WHERE Fecha = (SELECT MAX(Fecha) FROM GRANTT_DASH.src.iw_costop c2 WHERE c2.CodProd = c1.CodProd)`;

  const post = sql => fetch(`${url}/consulta`, {
    method: 'POST',
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, max_filas: 5000 }),
  });

  try {
    const [rProd, rCosto] = await Promise.all([post(sqlProd), post(sqlCosto)]);
    if (!rProd.ok) { res.status(502).json({ error: `API ${rProd.status}` }); return; }
    const dProd  = await rProd.json();
    const costos = {};
    if (rCosto.ok) {
      const dCosto = await rCosto.json();
      (dCosto.filas || []).forEach(r => { costos[r.sku.trim()] = r; });
    }
    const productos = (dProd.filas || []).map(p => {
      const c = costos[p.sku] || {};
      return { ...p, costo: c.costo ?? p.costo, stock: c.stock ?? 0 };
    });
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ productos, generado: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar' });
  }
};

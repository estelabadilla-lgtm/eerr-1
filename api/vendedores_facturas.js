// Vercel serverless function: devuelve folio -> vendedor para facturas emitidas desde dic 2025.
// Usado por la pestaña Comisiones del dashboard Grantt.

module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Faltan DASH_API_URL o DASH_API_KEY en Vercel' });
    return;
  }

  const sql = `
    SELECT DISTINCT m.NumDoc AS folio, RTRIM(COALESCE(v.VenDes, '')) AS vendedor
    FROM softland.cwmovim m
    JOIN softland.cwcpbte c
      ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
    LEFT JOIN softland.cwtvend v ON v.VenCod = m.VendCod
    WHERE (m.CpbAno = '2025' OR m.CpbAno >= '2026')
      AND c.CpbEst = 'V'
      AND c.CpbNormaTrib = 'S'
      AND m.PctCod IN ('10-04-01-01','10-05-01-02')
      AND m.MovFe >= '2025-12-01'
      AND m.VendCod IS NOT NULL
      AND m.VendCod <> ''`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 50000 }),
    });
    if (!r.ok) { res.status(502).json({ error: `API ${r.status}` }); return; }
    const data = await r.json();
    if (data.truncado) { res.status(502).json({ error: 'Respuesta truncada' }); return; }
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ filas: data.filas, generado: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar con la API' });
  }
};

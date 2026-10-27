// Vercel serverless function: facturas Sodimac desde Softland para Flujo de Caja.
// Auxiliar RUT 96792430 (Sodimac S.A), todas las cuentas.
// Tipos de documento: FA (factura venta), NC (nota de crédito), FP (factura proveedor).

module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Faltan DASH_API_URL o DASH_API_KEY en Vercel' });
    return;
  }

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const anio = parseInt(hoy.slice(0, 4), 10);

  const sql = `
    WITH mov AS (
      SELECT m.PctCod, m.CodAux, m.TtdCod, m.NumDoc,
             COALESCE(NULLIF(m.MovTipDocRef, ''), m.TtdCod) AS rtip,
             COALESCE(NULLIF(m.MovNumDocRef, 0), m.NumDoc) AS rnum,
             m.MovDebe, m.MovHaber, m.MovFv, m.MovFe
      FROM softland.cwmovim m
      JOIN softland.cwcpbte c
        ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
      JOIN softland.cwtauxi a ON a.CodAux = m.CodAux
      WHERE m.CpbAno = '${anio}'
        AND c.CpbEst = 'V'
        AND c.CpbNormaTrib = 'S'
        AND a.RutAux LIKE '96792430%'
    ),
    doc AS (
      SELECT PctCod, CodAux, rtip, rnum,
             SUM(MovDebe - MovHaber) AS saldo,
             MAX(CASE WHEN TtdCod = rtip AND NumDoc = rnum THEN MovFv END) AS fv,
             MIN(MovFv) AS fv2,
             MIN(MovFe) AS fe
      FROM mov
      WHERE rtip IN ('FA','NC','FP')
      GROUP BY PctCod, CodAux, rtip, rnum
      HAVING ABS(SUM(MovDebe - MovHaber)) >= 1
    )
    SELECT d.PctCod AS cuenta,
           LTRIM(RTRIM(t.DesDoc)) AS tipo,
           d.rnum AS doc,
           CONVERT(char(10), d.fe, 23) AS fe,
           CONVERT(char(10), COALESCE(d.fv, d.fv2), 23) AS fv,
           d.saldo
    FROM doc d
    LEFT JOIN softland.cwttdoc t ON t.CodDoc = d.rtip
    ORDER BY d.fv`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 5000 }),
    });
    if (!r.ok) { res.status(502).json({ error: `API ${r.status}` }); return; }
    const data = await r.json();
    if (data.truncado) { res.status(502).json({ error: 'Respuesta truncada' }); return; }
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ corte: hoy, filas: data.filas, generado: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar con la API' });
  }
};

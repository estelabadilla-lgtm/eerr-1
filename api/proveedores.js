// Vercel serverless function: proveedores nacionales desde Softland para Flujo de Caja.
// Cuenta 20-03-01-01 — documentos con saldo pendiente (lo que se debe a proveedores).

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
      SELECT m.CodAux, m.TtdCod, m.NumDoc,
             COALESCE(NULLIF(m.MovTipDocRef, ''), m.TtdCod) AS rtip,
             COALESCE(NULLIF(m.MovNumDocRef, 0), m.NumDoc) AS rnum,
             m.MovHaber - m.MovDebe AS saldo,
             m.MovFv, m.MovFe
      FROM softland.cwmovim m
      JOIN softland.cwcpbte c
        ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
      WHERE m.CpbAno >= '${anio - 1}'
        AND c.CpbEst = 'V'
        AND m.PctCod = '20-03-01-01'
    ),
    prov_neto AS (
      SELECT CodAux
      FROM mov
      GROUP BY CodAux
      HAVING SUM(saldo) >= 1
    ),
    doc AS (
      SELECT m.CodAux, m.rtip, m.rnum,
             SUM(m.saldo) AS saldo,
             MAX(CASE WHEN m.TtdCod = m.rtip AND m.NumDoc = m.rnum THEN m.MovFv END) AS fv,
             MIN(m.MovFv) AS fv2,
             MIN(m.MovFe) AS fe
      FROM mov m
      JOIN prov_neto p ON p.CodAux = m.CodAux
      GROUP BY m.CodAux, m.rtip, m.rnum
      HAVING SUM(m.saldo) >= 1
    )
    SELECT a.RutAux AS rut, RTRIM(a.NomAux) AS nombre,
           LTRIM(RTRIM(t.DesDoc)) AS tipo,
           d.rnum AS doc,
           CONVERT(char(10), d.fe, 23) AS fe,
           CONVERT(char(10), COALESCE(d.fv, d.fv2), 23) AS fv,
           d.saldo
    FROM doc d
    LEFT JOIN softland.cwtauxi a ON a.CodAux = d.CodAux
    LEFT JOIN softland.cwttdoc t ON t.CodDoc = d.rtip
    ORDER BY a.RutAux, d.fv`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 10000 }),
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

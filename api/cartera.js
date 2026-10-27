// Vercel serverless function: cartera de clientes desde Softland para "Cartera Vencidos".
// Corre en el servidor; la API key nunca llega al navegador.
//
// GET /api/cartera
// Devuelve un documento pendiente por fila (saldo distinto de 0), igual que el informe
// "Traspaso a Excel de saldos de documentos por auxiliar" (por fecha de vencimiento).
// Los pagos y notas de crédito se imputan a la factura con MovTipDocRef / MovNumDocRef.

module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Faltan DASH_API_URL o DASH_API_KEY en Vercel' });
    return;
  }

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }); // aaaa-mm-dd
  const anio = parseInt(hoy.slice(0, 4), 10); // número, nunca texto libre dentro del SQL

  const sql = `
    WITH mov AS (
      SELECT m.PctCod, m.CodAux, m.TtdCod, m.NumDoc,
             COALESCE(NULLIF(m.MovTipDocRef, ''), m.TtdCod) AS rtip,
             COALESCE(NULLIF(m.MovNumDocRef, 0), m.NumDoc) AS rnum,
             m.MovDebe, m.MovHaber, m.MovFv, m.VendCod, c.CpbFch AS fch
      FROM softland.cwmovim m
      JOIN softland.cwcpbte c
        ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
      WHERE m.CpbAno = '${anio}'
        AND c.CpbEst = 'V'
        AND c.CpbNormaTrib = 'S'
        AND m.PctCod IN ('10-04-01-01', '10-05-01-02', '20-05-01-02')
    ),
    doc AS (
      SELECT PctCod, CodAux, rtip, rnum,
             SUM(CASE WHEN PctCod LIKE '2%' THEN MovHaber - MovDebe ELSE MovDebe - MovHaber END) AS saldo,
             MAX(CASE WHEN TtdCod = rtip AND NumDoc = rnum THEN MovFv END) AS fv,
             MIN(MovFv) AS fv2,
             MAX(CASE WHEN TtdCod = rtip AND NumDoc = rnum THEN VendCod END) AS ven,
             MAX(CASE WHEN TtdCod = rtip AND NumDoc = rnum THEN fch END) AS fe
      FROM mov
      GROUP BY PctCod, CodAux, rtip, rnum
      HAVING ABS(SUM(MovDebe - MovHaber)) >= 1
    )
    SELECT d.PctCod AS cuenta, a.RutAux AS rut, RTRIM(a.NomAux) AS nombre, a.Bloqueado AS bl,
           LTRIM(RTRIM(t.DesDoc)) AS tipo, d.rnum AS doc,
           CONVERT(char(10), COALESCE(d.fv, d.fv2), 23) AS fv, d.saldo,
           RTRIM(v.VenDes) AS vendedor,
           CONVERT(char(10), d.fe, 23) AS fe
    FROM doc d
    LEFT JOIN softland.cwtauxi a ON a.CodAux = d.CodAux
    LEFT JOIN softland.cwttdoc t ON t.CodDoc = d.rtip
    LEFT JOIN softland.cwtvend v ON v.VenCod = d.ven`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 50000 }),
    });
    if (!r.ok) {
      res.status(502).json({ error: `API ${r.status}` });
      return;
    }
    const data = await r.json();
    if (data.truncado) {
      res.status(502).json({ error: 'Respuesta truncada: demasiadas filas' });
      return;
    }
    // Softland se copia cada noche: guardar 15 min en el CDN es suficiente
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ corte: hoy, filas: data.filas, generado: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar con la API' });
  }
};

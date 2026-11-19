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
    WITH cpbtes AS (
      -- Asientos contables validados desde dic 2025 con norma tributaria S
      SELECT c.CpbAno, c.CpbNum, c.AreaCod,
             MAX(CASE WHEN m2.VendCod IS NOT NULL AND LTRIM(RTRIM(m2.VendCod)) <> ''
                      THEN LTRIM(RTRIM(m2.VendCod)) END) AS vend_cod
      FROM GRANTT_DASH.src.cwcpbte c
      JOIN GRANTT_DASH.src.cwmovim m2
        ON m2.CpbAno = c.CpbAno AND m2.CpbNum = c.CpbNum AND m2.AreaCod = c.AreaCod
      WHERE c.CpbEst = 'V'
        AND c.CpbNormaTrib = 'S'
        AND (c.CpbAno = '2025' OR c.CpbAno >= '2026')
      GROUP BY c.CpbAno, c.CpbNum, c.AreaCod
    ),
    folios AS (
      -- Facturas emitidas desde dic 2025: busca vendedor en cualquier linea del asiento
      SELECT DISTINCT m.NumDoc, m.CodAux,
             MAX(RTRIM(COALESCE(v.VenDes,''))) AS vendedor,
             MAX(COALESCE(a.Bloqueado,'N')) AS bloqueado,
             MAX(m.MovFv) AS vencimiento
      FROM GRANTT_DASH.src.cwmovim m
      JOIN cpbtes cp
        ON cp.CpbAno = m.CpbAno AND cp.CpbNum = m.CpbNum AND cp.AreaCod = m.AreaCod
      LEFT JOIN GRANTT_DASH.src.cwtvend v ON v.VenCod = cp.vend_cod
      LEFT JOIN GRANTT_DASH.src.cwtauxi a ON a.CodAux = m.CodAux
      WHERE m.PctCod IN ('10-04-01-01','10-05-01-02')
        AND m.MovFe >= '2025-12-01'
        AND cp.vend_cod IS NOT NULL
      GROUP BY m.NumDoc, m.CodAux
    ),
    saldos AS (
      -- Saldo de cada folio: sin filtro PctCod para incluir pagos en cuentas banco/caja.
      -- INNER JOIN a folios limita el scan solo a movimientos que referencian nuestras facturas.
      SELECT COALESCE(NULLIF(m.MovNumDocRef,0), m.NumDoc) AS folio_ref,
             m.CodAux,
             SUM(m.MovDebe - m.MovHaber) AS saldo,
             MAX(CASE WHEN m.MovHaber > 0 AND (
               UPPER(LTRIM(RTRIM(t.DesDoc))) LIKE '%CHEQUE%'
               OR UPPER(m.TtdCod) IN ('CQ','CH','CHQ','VCH','DCH')
             ) THEN 1 ELSE 0 END) AS con_cheque
      FROM GRANTT_DASH.src.cwmovim m
      JOIN GRANTT_DASH.src.cwcpbte c
        ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
      LEFT JOIN GRANTT_DASH.src.cwttdoc t ON t.CodDoc = m.TtdCod
      INNER JOIN folios fx
        ON fx.NumDoc = COALESCE(NULLIF(m.MovNumDocRef,0), m.NumDoc)
        AND fx.CodAux = m.CodAux
      WHERE c.CpbEst = 'V'
        AND m.CpbNum <> '00000000'
      GROUP BY COALESCE(NULLIF(m.MovNumDocRef,0), m.NumDoc), m.CodAux
    )
    SELECT f.NumDoc AS folio, f.vendedor, f.bloqueado, f.vencimiento,
           CASE WHEN ABS(COALESCE(s.saldo, 999999)) < 1 THEN
             CASE WHEN COALESCE(s.con_cheque,0)=1 THEN 'cheque' ELSE 'pagada' END
           ELSE 'pendiente' END AS estado_pago,
           COALESCE(s.saldo, 999999) AS saldo_pendiente
    FROM folios f
    LEFT JOIN saldos s ON s.folio_ref = f.NumDoc AND s.CodAux = f.CodAux`;

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

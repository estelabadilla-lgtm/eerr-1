// Devuelve las facturas VE que fueron pagadas con cheque que aun esta en 10-05-01-02
// Enlace: mismo comprobante (CpbAno+CpbNum) tiene CR en 10-04-01-01 (pago VE) y DR en 10-05-01-02 (cheque recibido)

module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Sin credenciales' }); return; }

  const sql = `
    WITH ch_saldo AS (
      -- Cheques en 10-05-01-02 con saldo pendiente (no depositados)
      SELECT COALESCE(NULLIF(m.MovNumDocRef,0), m.NumDoc) AS ch_ref,
             m.CodAux,
             SUM(m.MovDebe - m.MovHaber) AS saldo_ch
      FROM softland.cwmovim m
      JOIN softland.cwcpbte c ON c.CpbAno=m.CpbAno AND c.CpbNum=m.CpbNum AND c.AreaCod=m.AreaCod
      WHERE m.PctCod='10-05-01-02' AND c.CpbEst='V' AND m.CpbNum <> '00000000'
      GROUP BY COALESCE(NULLIF(m.MovNumDocRef,0), m.NumDoc), m.CodAux
      HAVING SUM(m.MovDebe - m.MovHaber) > 0.5
    ),
    ch_receipt AS (
      -- Comprobante y fecha vencimiento del cheque recibido (DR en 10-05-01-02)
      SELECT m.NumDoc AS ch_num, m.CodAux,
             m.CpbAno, m.CpbNum, m.AreaCod,
             m.MovFv AS vce_ch
      FROM softland.cwmovim m
      JOIN softland.cwcpbte c ON c.CpbAno=m.CpbAno AND c.CpbNum=m.CpbNum AND c.AreaCod=m.AreaCod
      JOIN ch_saldo cs ON cs.ch_ref = m.NumDoc AND cs.CodAux = m.CodAux
      WHERE m.PctCod='10-05-01-02'
        AND m.MovDebe > 0
        AND m.MovNumDocRef = 0
        AND c.CpbEst='V'
    )
    -- VE invoice cleared in the same comprobante that received the cheque
    SELECT ve.MovNumDocRef AS folio, ve.CodAux, cr.vce_ch
    FROM ch_receipt cr
    JOIN softland.cwmovim ve
      ON ve.CpbAno = cr.CpbAno AND ve.CpbNum = cr.CpbNum AND ve.AreaCod = cr.AreaCod
      AND ve.CodAux = cr.CodAux
      AND ve.PctCod = '10-04-01-01'
      AND ve.MovHaber > 0
      AND ve.MovNumDocRef > 0
    WHERE (ve.CpbAno = '2025' OR ve.CpbAno >= '2026')`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 10000 }),
    });
    if (!r.ok) { res.status(502).json({ error: `API ${r.status}` }); return; }
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ filas: data.filas || [], generado: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
};

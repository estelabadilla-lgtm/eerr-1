// Diagnóstico temporal: qué TtdCod usan los movimientos de pago (crédito) en cwmovim
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Sin credenciales' }); return; }

  const folio = req.query.folio || '37524';
  const sql = `
    SELECT m.NumDoc, m.TtdCod, LTRIM(RTRIM(t.DesDoc)) AS DesDoc,
           m.PctCod, m.MovDebe, m.MovHaber, m.MovNumDocRef,
           m.CodAux, m.CpbAno, m.CpbNum
    FROM softland.cwmovim m
    JOIN softland.cwcpbte c ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
    LEFT JOIN softland.cwttdoc t ON t.CodDoc = m.TtdCod
    WHERE c.CpbEst = 'V'
      AND (m.MovNumDocRef = ${parseInt(folio)}
           OR (m.NumDoc = ${parseInt(folio)} AND m.PctCod IN ('10-04-01-01','10-05-01-02')))
    ORDER BY m.CpbAno, m.CpbNum`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 100 }),
    });
    const data = await r.json();
    res.setHeader('Cache-Control','no-store');
    res.status(200).json(data.filas || []);
  } catch(e) { res.status(502).json({ error: String(e) }); }
};

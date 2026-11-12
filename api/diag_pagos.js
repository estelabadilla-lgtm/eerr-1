// Diagnóstico temporal: qué TtdCod usan los movimientos de pago (crédito) en cwmovim
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Sin credenciales' }); return; }

  const sql = `
    SELECT m.TtdCod, LTRIM(RTRIM(t.DesDoc)) AS descripcion, COUNT(*) AS cant
    FROM softland.cwmovim m
    JOIN softland.cwcpbte c ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
    LEFT JOIN softland.cwttdoc t ON t.CodDoc = m.TtdCod
    WHERE m.CpbAno >= '2026'
      AND c.CpbEst = 'V'
      AND m.PctCod IN ('10-04-01-01','10-05-01-02')
      AND m.MovHaber > 0
    GROUP BY m.TtdCod, t.DesDoc
    ORDER BY cant DESC`;

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

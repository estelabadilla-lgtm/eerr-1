// Diagnóstico: totales oct 2026 agrupados por CpbNormaTrib
// GET /api/eerr-diff
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan variables de entorno' }); return; }

  // Igual que eerr.js: m.CpbMes como string, sin CAST
  const sql = `
    SELECT c.CpbNormaTrib        AS norma_trib,
           COUNT(DISTINCT c.CpbNum) AS n_comprobantes,
           SUM(m.MovDebe)        AS debe_total,
           SUM(m.MovHaber)       AS haber_total
    FROM GRANTT_DASH.src.cwcpbte c
    JOIN GRANTT_DASH.src.cwmovim m
      ON m.CpbAno = c.CpbAno AND m.CpbNum = c.CpbNum AND m.AreaCod = c.AreaCod
    WHERE c.CpbAno = '2026'
      AND c.CpbEst = 'V'
      AND m.CpbMes = '10'
    GROUP BY c.CpbNormaTrib`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 20 }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      res.status(502).json({ error: `API ${r.status}`, detail: txt });
      return;
    }
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
};

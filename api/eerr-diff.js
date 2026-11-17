// Diagnóstico: totales oct 2026 agrupados por CpbNormaTrib
// GET /api/eerr-diff
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan variables de entorno' }); return; }

  // Idéntico a eerr.js pero sin filtro NormaTrib y agrupado por norma_trib + mes
  const sql = `
    SELECT c.CpbNormaTrib        AS norma_trib,
           CAST(m.CpbMes AS int) AS mes,
           COUNT(*)              AS n,
           SUM(m.MovDebe)        AS debe,
           SUM(m.MovHaber)       AS haber
    FROM GRANTT_DASH.src.cwmovim m
    JOIN GRANTT_DASH.src.cwcpbte c
      ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
    WHERE m.CpbAno = '2026'
      AND c.CpbEst = 'V'
      AND m.CpbMes BETWEEN '00' AND '12'
    GROUP BY c.CpbNormaTrib, m.CpbMes`;

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

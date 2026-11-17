// Diagnóstico: comprobantes de oct 2026 excluidos por CpbNormaTrib != 'S'
// GET /api/eerr-diff
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan variables de entorno' }); return; }

  // Usar m.CpbMes (de cwmovim) igual que eerr.js — agrupar por comprobante en mes 10
  const sql = `
    SELECT c.CpbNum        AS num_cpb,
           c.CpbNormaTrib  AS norma_trib,
           c.AreaCod       AS area,
           c.CpbTipo       AS tipo,
           c.CpbGls        AS glosa,
           CAST(m.CpbMes AS int) AS mes_cpb,
           SUM(m.MovDebe)  AS debe,
           SUM(m.MovHaber) AS haber
    FROM softland.cwcpbte c
    JOIN softland.cwmovim m
      ON m.CpbAno = c.CpbAno AND m.CpbNum = c.CpbNum AND m.AreaCod = c.AreaCod
    WHERE c.CpbAno = '2026'
      AND c.CpbEst = 'V'
      AND CAST(m.CpbMes AS int) = 10
      AND (c.CpbNormaTrib IS NULL OR c.CpbNormaTrib <> 'S')
    GROUP BY c.CpbNum, c.CpbNormaTrib, c.AreaCod, c.CpbTipo, c.CpbGls, m.CpbMes
    ORDER BY c.CpbNum`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 500 }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      res.status(502).json({ error: `API ${r.status}`, detail: txt });
      return;
    }
    const data = await r.json();
    const filas = data.filas || [];
    const totalDebe  = filas.reduce((s, f) => s + (f.debe  || 0), 0);
    const totalHaber = filas.reduce((s, f) => s + (f.haber || 0), 0);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      total_comprobantes: filas.length,
      total_debe:  totalDebe,
      total_haber: totalHaber,
      neto_haber_menos_debe: totalHaber - totalDebe,
      filas,
    });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
};

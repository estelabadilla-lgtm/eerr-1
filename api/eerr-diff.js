// Diagnóstico: comprobantes con mes <= 10 pero ingresados después del 31/10/2026
// GET /api/eerr-diff
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan variables de entorno' }); return; }

  const sql = `
    SELECT c.CpbNum   AS num_cpb,
           c.CpbFec   AS fecha_cpb,
           CAST(c.CpbMes AS int) AS mes_cpb,
           c.AreaCod  AS area,
           c.CpbTipo  AS tipo,
           c.CpbGls   AS glosa,
           SUM(m.MovDebe)  AS debe,
           SUM(m.MovHaber) AS haber,
           COUNT(*)        AS n_lineas
    FROM softland.cwcpbte c
    JOIN softland.cwmovim m
      ON m.CpbAno = c.CpbAno AND m.CpbNum = c.CpbNum AND m.AreaCod = c.AreaCod
    WHERE c.CpbAno  = '2026'
      AND c.CpbEst  = 'V'
      AND c.CpbNormaTrib = 'S'
      AND CAST(c.CpbMes AS int) BETWEEN 1 AND 10
      AND c.CpbFec > '2026-10-31'
    GROUP BY c.CpbNum, c.CpbFec, c.CpbMes, c.AreaCod, c.CpbTipo, c.CpbGls
    ORDER BY c.CpbFec DESC, c.CpbNum`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 500 }),
    });
    if (!r.ok) { res.status(502).json({ error: `API ${r.status}` }); return; }
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ filas: data.filas, total: data.filas?.length || 0 });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar' });
  }
};

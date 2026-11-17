// Diagnóstico: comprobantes de octubre 2026 excluidos de la API (CpbNormaTrib != 'S')
// GET /api/eerr-diff
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan variables de entorno' }); return; }

  // Query 1: comprobantes oct con NormaTrib distinto de S
  const sqlNoNorm = `
    SELECT c.CpbNum   AS num_cpb,
           c.CpbFec   AS fecha_cpb,
           CAST(c.CpbMes AS int) AS mes_cpb,
           c.CpbNormaTrib AS norma_trib,
           c.AreaCod  AS area,
           c.CpbTipo  AS tipo,
           c.CpbGls   AS glosa,
           SUM(m.MovDebe)  AS debe,
           SUM(m.MovHaber) AS haber
    FROM softland.cwcpbte c
    JOIN softland.cwmovim m
      ON m.CpbAno = c.CpbAno AND m.CpbNum = c.CpbNum AND m.AreaCod = c.AreaCod
    WHERE c.CpbAno  = '2026'
      AND c.CpbEst  = 'V'
      AND CAST(c.CpbMes AS int) = 10
      AND (c.CpbNormaTrib IS NULL OR c.CpbNormaTrib <> 'S')
    GROUP BY c.CpbNum, c.CpbFec, c.CpbMes, c.CpbNormaTrib, c.AreaCod, c.CpbTipo, c.CpbGls
    ORDER BY c.CpbFec DESC, c.CpbNum`;

  // Query 2: total octubre con NormaTrib = S (lo que ve la API)
  const sqlConNorm = `
    SELECT COUNT(DISTINCT c.CpbNum) AS n_cpb,
           SUM(m.MovDebe)  AS debe_total,
           SUM(m.MovHaber) AS haber_total
    FROM softland.cwcpbte c
    JOIN softland.cwmovim m
      ON m.CpbAno = c.CpbAno AND m.CpbNum = c.CpbNum AND m.AreaCod = c.AreaCod
    WHERE c.CpbAno  = '2026'
      AND c.CpbEst  = 'V'
      AND c.CpbNormaTrib = 'S'
      AND CAST(c.CpbMes AS int) = 10`;

  try {
    const [r1, r2] = await Promise.all([
      fetch(`${url}/consulta`, {
        method: 'POST',
        headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlNoNorm, max_filas: 500 }),
      }),
      fetch(`${url}/consulta`, {
        method: 'POST',
        headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlConNorm, max_filas: 10 }),
      }),
    ]);

    const [d1, d2] = await Promise.all([r1.json(), r2.json()]);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      excluidos_no_norm: {
        total: d1.filas?.length || 0,
        filas: d1.filas || [],
        error: d1.error,
      },
      incluidos_norm_s: {
        filas: d2.filas || [],
        error: d2.error,
      },
    });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
};

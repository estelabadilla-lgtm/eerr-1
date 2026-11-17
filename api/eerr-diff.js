// Diagnóstico: neto por categoría de cuenta (primeros 2 dígitos) ene-oct 2026
// Para detectar si hay categorías fuera de 30/31/40/41 que el dashboard no suma
// GET /api/eerr-diff
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan variables de entorno' }); return; }

  const sql = `
    SELECT LEFT(m.PctCod, 2)    AS cat2,
           CAST(m.CpbMes AS int) AS mes,
           SUM(m.MovDebe)        AS debe,
           SUM(m.MovHaber)       AS haber
    FROM GRANTT_DASH.src.cwmovim m
    JOIN GRANTT_DASH.src.cwcpbte c
      ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
    WHERE m.CpbAno = '2026'
      AND c.CpbEst = 'V'
      AND c.CpbNormaTrib = 'S'
      AND m.CpbMes BETWEEN '01' AND '10'
    GROUP BY LEFT(m.PctCod, 2), m.CpbMes`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 5000 }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      res.status(502).json({ error: `API ${r.status}`, detail: txt.slice(0, 500) });
      return;
    }
    const data = await r.json();
    const filas = data.filas || [];

    // Agrupar por cat2, sumando meses 1-10
    const totales = {};
    for (const f of filas) {
      if (!totales[f.cat2]) totales[f.cat2] = { debe: 0, haber: 0 };
      totales[f.cat2].debe  += f.debe  || 0;
      totales[f.cat2].haber += f.haber || 0;
    }
    const resumen = Object.entries(totales)
      .map(([cat2, v]) => ({ cat2, debe: v.debe, haber: v.haber, neto: v.haber - v.debe }))
      .sort((a, b) => a.cat2.localeCompare(b.cat2));

    // Suma dashboard: cat2 30, 31, 40, 41
    const dashCats = ['30','31','40','41'];
    const dashTotal = resumen
      .filter(r => dashCats.includes(r.cat2))
      .reduce((s, r) => s + r.neto, 0);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ resumen, dashboard_total: dashTotal, filas_raw: filas.length });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
};

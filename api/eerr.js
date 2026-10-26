// Vercel serverless function: entrega el Libro Mayor agregado desde Softland
// para el EERR del dashboard. Corre en el servidor; la API key nunca llega al navegador.
//
// GET /api/eerr?anio=2026
// Devuelve una fila por cuenta + mes + centro de costo, con debe y haber.
// Mes 0 = comprobante de apertura (saldo anterior).

module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Faltan DASH_API_URL o DASH_API_KEY en Vercel' });
    return;
  }

  // Año: solo un número entre 2015 y 2100 (nunca texto libre dentro del SQL)
  const hoyCL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  let anio = parseInt((req.query && req.query.anio) || hoyCL.getFullYear(), 10);
  if (!Number.isInteger(anio) || anio < 2015 || anio > 2100) {
    res.status(400).json({ error: 'anio inválido' });
    return;
  }

  // Mismo criterio que el informe "Libro Mayor" de Softland:
  // comprobantes vigentes (V), norma tributaria, todas las áreas.
  const sql = `
    SELECT m.PctCod AS cuenta,
           MAX(RTRIM(p.PCDESC)) AS nombre,
           CAST(m.CpbMes AS int) AS mes,
           m.CcCod AS cc,
           SUM(m.MovDebe) AS debe,
           SUM(m.MovHaber) AS haber,
           COUNT(*) AS n
    FROM softland.cwmovim m
    JOIN softland.cwcpbte c
      ON c.CpbAno = m.CpbAno AND c.CpbNum = m.CpbNum AND c.AreaCod = m.AreaCod
    LEFT JOIN softland.cwpctas p ON p.PCCODI = m.PctCod
    WHERE m.CpbAno = '${anio}'
      AND c.CpbEst = 'V'
      AND c.CpbNormaTrib = 'S'
      AND m.CpbMes BETWEEN '00' AND '12'
    GROUP BY m.PctCod, m.CpbMes, m.CcCod`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 50000 }),
    });
    if (!r.ok) {
      res.status(502).json({ error: `API ${r.status}` });
      return;
    }
    const data = await r.json();
    if (data.truncado) {
      res.status(502).json({ error: 'Respuesta truncada: demasiadas filas' });
      return;
    }
    // Softland se copia cada noche: guardar 15 min en el CDN es suficiente
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ anio, filas: data.filas, generado: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar con la API' });
  }
};

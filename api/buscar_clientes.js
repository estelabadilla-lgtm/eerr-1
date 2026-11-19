module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Config' }); return; }

  const q = (req.query.q || '').trim();
  if (q.length < 2) { res.status(200).json({ clientes: [] }); return; }

  const esc = q.replace(/'/g, "''");
  const sql = `
    SELECT TOP 20
      CodAux,
      LTRIM(RTRIM(NomAux)) AS NomAux,
      RutAux,
      Bloqueado,
      LTRIM(RTRIM(COALESCE(DirAux,''))) AS DirAux
    FROM GRANTT_DASH.src.cwtauxi
    WHERE ClaCli = 'S' AND ActAux = 'S'
      AND (
        UPPER(NomAux) LIKE UPPER('%${esc}%')
        OR RutAux LIKE '%${esc}%'
        OR CodAux LIKE '%${esc}%'
      )
    ORDER BY NomAux`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 20 }),
    });
    if (!r.ok) { res.status(502).json({ error: `API ${r.status}` }); return; }
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ clientes: data.filas || [] });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar' });
  }
};

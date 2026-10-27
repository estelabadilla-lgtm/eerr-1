// Diagnóstico: busca un documento específico sin filtros
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan env vars' }); return; }

  const doc = parseInt(req.query.doc || '41115', 10);
  const sql = `
    SELECT TOP 20 m.PctCod, m.CodAux, a.NomAux, m.TtdCod, m.NumDoc,
           m.CpbAno, m.MovFe, m.MovFv, m.MovDebe, m.MovHaber,
           c.CpbNormaTrib, c.CpbEst
    FROM softland.cwmovim m
    JOIN softland.cwcpbte c ON c.CpbAno=m.CpbAno AND c.CpbNum=m.CpbNum AND c.AreaCod=m.AreaCod
    LEFT JOIN softland.cwtauxi a ON a.CodAux=m.CodAux
    WHERE m.NumDoc=${doc}`;
  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 20 }),
    });
    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};

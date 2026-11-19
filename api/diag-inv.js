module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'env' }); return; }

  // Check Joel's new folios in iw_gsaen
  const sql = `
    SELECT g.Folio, g.Fecha, g.CodVendedor, RTRIM(v.VenDes) AS vendedor, g.CodAux, g.TtdCod, g.NetoAfecto, g.Total
    FROM GRANTT_DASH.src.iw_gsaen g
    LEFT JOIN GRANTT_DASH.src.cwtvend v ON v.VenCod = g.CodVendedor
    WHERE g.Folio BETWEEN 41400 AND 41440
      AND g.Fecha >= '2026-11-01'
    ORDER BY g.Folio`;
  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 200 }),
    });
    const d = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(d);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};

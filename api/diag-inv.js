module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'env' }); return; }

  const tbl = (req.query.t || 'nw_nventa');
  const safe = ['nw_nventa','iw_gmovi','VentasDetalle','nw_detnv','iw_gsaen','IW_GSaEn_RefDTE'].includes(tbl) ? tbl : 'nw_nventa';
  const sql = `SELECT TOP 2 * FROM GRANTT_DASH.src.${safe}`;
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

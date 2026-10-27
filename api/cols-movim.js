// Endpoint temporal de diagnóstico: devuelve las columnas de cwmovim
module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) { res.status(500).json({ error: 'Faltan env vars' }); return; }

  const sql = `SELECT TOP 1 * FROM softland.cwmovim`;
  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 1 }),
    });
    const data = await r.json();
    const cols = data.filas && data.filas[0] ? Object.keys(data.filas[0]) : data;
    res.status(200).json({ cols });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};

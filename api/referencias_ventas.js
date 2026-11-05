// Vercel serverless function: OC y guías asociadas a cada factura de venta (Softland).
// TEMPORAL: modo exploración de esquema para ubicar las columnas.

module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Faltan DASH_API_URL o DASH_API_KEY en Vercel' });
    return;
  }

  const sql = `
    SELECT TABLE_NAME AS t, COLUMN_NAME AS c, DATA_TYPE AS d
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'softland'
      AND (TABLE_NAME LIKE 'iw_gsaen%' OR TABLE_NAME LIKE 'iw_gmovi%'
           OR TABLE_NAME LIKE 'nw_nventa%' OR TABLE_NAME LIKE '%ref%')
    ORDER BY TABLE_NAME, ORDINAL_POSITION`;

  try {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 5000 }),
    });
    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'No se pudo conectar con la API' });
  }
};

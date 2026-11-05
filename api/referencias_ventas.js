// Vercel serverless function: OC y guías asociadas a cada factura de venta (Softland).
// TEMPORAL: modo exploración de esquema para ubicar las columnas.

module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Faltan DASH_API_URL o DASH_API_KEY en Vercel' });
    return;
  }

  const q = req.query.q || 'tipos';
  const SQL = {
    tipos: `SELECT Tipo, SubTipoDocto, DTE_SiiTDoc, COUNT(*) AS n, MAX(Folio) AS maxFolio
            FROM softland.iw_gsaen WHERE Fecha >= '2026-10-01' GROUP BY Tipo, SubTipoDocto, DTE_SiiTDoc`,
    fac: `SELECT TOP 40 g.Tipo, g.NroInt, g.Folio, CONVERT(char(10), g.Fecha, 23) AS fe, g.Orden, g.Factura,
                 g.nvnumero, n.NumOC, g.AuxGuiaNum, g.AuxDocNum, g.TipDocRef, g.NumGuiaTrasp, RTRIM(g.NomAux) AS cli
          FROM softland.iw_gsaen g LEFT JOIN softland.nw_nventa n ON n.NVNumero = g.nvnumero
          WHERE g.Fecha >= '2026-11-01' ORDER BY g.Tipo, g.Folio`,
    ref: `SELECT TOP 80 r.Tipo, r.NroInt, g.Folio, r.LineaRef, r.CodRefSII, r.FolioRef, CONVERT(char(10), r.FechaRef, 23) AS fr
          FROM softland.IW_GSaEn_RefDTE r JOIN softland.iw_gsaen g ON g.Tipo = r.Tipo AND g.NroInt = r.NroInt
          WHERE g.Fecha >= '2026-11-01' ORDER BY g.Folio`,
  };
  const sql = SQL[q];
  if (!sql) { res.status(400).json({ error: 'q' }); return; }

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

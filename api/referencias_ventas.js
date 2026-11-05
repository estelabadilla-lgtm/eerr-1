// Vercel serverless function: OC y guías asociadas a cada factura de venta (Softland),
// para mostrarlas junto al folio en "Libro de Ventas".
//
// GET /api/referencias_ventas
// Devuelve { refs: { "<folio factura>": { oc: [...], gd: [...] } } }
// - OC: referencias 801 del DTE (IW_GSaEn_RefDTE); si no hay, NumOC de la nota de venta.
// - Guías: referencias 52 del DTE; si no hay, AuxGuiaNum de la factura.

module.exports = async (req, res) => {
  const url = process.env.DASH_API_URL;
  const key = process.env.DASH_API_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Faltan DASH_API_URL o DASH_API_KEY en Vercel' });
    return;
  }

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const desde = `${parseInt(hoy.slice(0, 4), 10) - 1}-01-01`; // año anterior y actual

  const sqlFac = `
    SELECT g.Folio AS folio, LTRIM(RTRIM(n.NumOC)) AS oc, g.AuxGuiaNum AS gd
    FROM softland.iw_gsaen g
    LEFT JOIN softland.nw_nventa n ON n.NVNumero = g.nvnumero AND g.nvnumero <> 0
    WHERE g.Tipo = 'F' AND g.SubTipoDocto = 'T' AND g.Fecha >= '${desde}'`;

  const sqlRef = `
    SELECT g.Folio AS folio, r.CodRefSII AS cod, LTRIM(RTRIM(r.FolioRef)) AS ref
    FROM softland.IW_GSaEn_RefDTE r
    JOIN softland.iw_gsaen g ON g.Tipo = r.Tipo AND g.NroInt = r.NroInt
    WHERE g.Tipo = 'F' AND g.SubTipoDocto = 'T' AND g.Fecha >= '${desde}'
      AND r.CodRefSII IN ('801', '52')`;

  const consulta = async (sql) => {
    const r = await fetch(`${url}/consulta`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, max_filas: 50000 }),
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const data = await r.json();
    if (data.truncado) throw new Error('Respuesta truncada');
    return data.filas;
  };

  try {
    const [fac, ref] = await Promise.all([consulta(sqlFac), consulta(sqlRef)]);
    const refs = {};
    const get = (f) => (refs[f] = refs[f] || { oc: [], gd: [] });
    const add = (arr, v) => { if (v && v !== '0' && !arr.includes(v)) arr.push(v); };

    for (const r of ref) add(get(String(r.folio))[r.cod === '801' ? 'oc' : 'gd'], r.ref);
    for (const f of fac) {
      const e = get(String(f.folio));
      if (!e.oc.length) add(e.oc, f.oc);
      if (!e.gd.length && f.gd) add(e.gd, String(f.gd));
    }
    for (const k of Object.keys(refs)) if (!refs[k].oc.length && !refs[k].gd.length) delete refs[k];

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ corte: hoy, refs, generado: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: err.message || 'No se pudo conectar con la API' });
  }
};

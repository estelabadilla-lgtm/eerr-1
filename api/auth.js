const crypto = require('crypto');

// vendedores: null = ver todos; array = filtrar solo esos nombres (minúsculas, coincide con TASAS)
const USERS = {
  joel:      { pass: 'joel2026',      vendedores: ['joel cordova','chilemat joel cordova'], codVendedor: '03', tabs: ['comisiones','vencidos','vehiculos','subdist'] },
  sandra:    { pass: 'sandra2026',    vendedores: ['sandra ortega','chilemat sandra'],      codVendedor: '06', tabs: ['comisiones','subdist'] },
  oscar:     { pass: 'oscar2026',     vendedores: ['oscar bucarey'],                        codVendedor: '02', tabs: ['comisiones','subdist'] },
  diego:     { pass: 'diego2026',     vendedores: ['diego rivero'],                         codVendedor: '05', tabs: ['comisiones','subdist'] },
  alejandra: { pass: 'alejandra2026', vendedores: null,                                     codVendedor: '01', tabs: ['vehiculos','vencidos','nv_retail','comisiones','subdist'] },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  let body = req.body;
  if (!body) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = JSON.parse(Buffer.concat(chunks).toString());
  }
  const { user = '', pass = '' } = body;
  const profile = USERS[user.toLowerCase().trim()];
  if (!profile || profile.pass !== pass) {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    return;
  }
  const secret = process.env.AUTH_SECRET || 'grantt_secret_2026';
  const payload = Buffer.from(JSON.stringify({
    user: user.toLowerCase(),
    vendedores: profile.vendedores,
    codVendedor: profile.codVendedor,
    tabs: profile.tabs,
    exp: Date.now() + 90 * 24 * 60 * 60 * 1000,
  })).toString('base64');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ token: `${payload}.${sig}`, vendedores: profile.vendedores, tabs: profile.tabs });
};

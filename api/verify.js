const crypto = require('crypto');

module.exports = (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token || '';
  if (!token) { res.status(401).json({ error: 'Sin token' }); return; }

  const dot = token.lastIndexOf('.');
  if (dot < 1) { res.status(401).json({ error: 'Token inválido' }); return; }
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const secret = process.env.AUTH_SECRET || 'grantt_secret_2026';
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (expected !== sig) { res.status(401).json({ error: 'Token inválido' }); return; }

  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64').toString()); }
  catch { res.status(401).json({ error: 'Token inválido' }); return; }

  if (data.exp < Date.now()) { res.status(401).json({ error: 'Token expirado' }); return; }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ user: data.user, vendedores: data.vendedores, tabs: data.tabs });
};

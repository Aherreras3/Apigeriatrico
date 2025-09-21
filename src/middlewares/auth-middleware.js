// middlewares/auth-middleware.js
const jwt = require('jsonwebtoken');
const { COOKIE_NAME } = require('../../config/cookies');

function verificarToken(req, res, next) {
  // 1) Cookie (web: fetch(..., { credentials:'include' }))
  let token = req.cookies?.[COOKIE_NAME];

  // 2) Authorization: Bearer <token> (móvil / herramientas)
  if (!token) {
    const h = req.headers['authorization'] || req.headers['Authorization'];
    if (h && typeof h === 'string' && /^bearer\s+/i.test(h)) {
      token = h.replace(/^bearer\s+/i, '').trim();
    }
  }

  if (!token) return res.status(401).json({ mensaje: 'Token no proporcionado' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, is_superadmin, id_geriatrico }
    next();
  } catch {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}

module.exports = verificarToken;

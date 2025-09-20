// src/middlewares/auth-middleware.js
const jwt = require('jsonwebtoken');

/**
 * Busca el token en varios lugares:
 * 1) Cookie (nombre configurable): AUTH_COOKIE_NAME | 'token' | 'myTokenName'
 * 2) Header: Authorization: Bearer <token>
 * 3) Header alterno: X-Token
 */
function getTokenFromReq(req) {
  // 1) Cookies (requiere app.use(cookieParser()) previamente)
  const candidates = [
    process.env.AUTH_COOKIE_NAME || 'token',
    'myTokenName', // compatibilidad si alguna parte del código lo usa
  ];
  if (req.cookies) {
    for (const name of candidates) {
      const v = req.cookies[name];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  }

  // 2) Authorization: Bearer <token>
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  // 3) X-Token (útil en pruebas/móvil)
  const xt = req.headers['x-token'];
  if (typeof xt === 'string' && xt.length > 0) return xt.trim();

  return null;
}

function verificarToken(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded debería contener { id, is_superadmin, id_geriatrico } según como lo firmas
    req.user = decoded;
    return next();
  } catch (_e) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}

module.exports = verificarToken;

// src/middlewares/auth-middleware.js
const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  // 1) Cookie (web: fetch(..., { credentials: 'include' }))
  let token = req.cookies?.token;

  // 2) Header Authorization: Bearer <token> (móvil)
  if (!token) {
    const h = req.headers['authorization'] || req.headers['Authorization'];
    if (h && typeof h === 'string' && h.toLowerCase().startsWith('bearer ')) {
      token = h.slice(7).trim();
    }
  }

  if (!token) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, id_geriatrico, rol }
    next();
  } catch (_e) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}

module.exports = verificarToken;

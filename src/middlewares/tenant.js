// src/middlewares/tenant.js
const db = require('../db');

module.exports = async function requireGeriatrico(req, res, next) {
  const user = req.user;                        // lo setea auth-middleware (JWT)
  const requested = req.header('X-Geriatrico-Id'); // si el front eligió contexto

  try {
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    // SUPERUSUARIO: usa el header (selección del front)
    if (user.is_superadmin) {
      if (!requested) {
        return res.status(400).json({ error: 'Selecciona un geriátrico' });
      }
      const ok = await db.query(
        'SELECT 1 FROM geriatrico WHERE id_geriatrico = $1 LIMIT 1',
        [requested]
      );
      if (!ok.rowCount) return res.status(400).json({ error: 'Geriátrico no válido' });

      req.geriatricoId = Number(requested);
      return next();
    }

    // ADMIN / CUIDADOR: ignora header y usa su vinculación activa
    const row = await db.query(
      `SELECT id_geriatrico
         FROM geriatrico_usuario
        WHERE id_usuario=$1 AND activo=TRUE
        ORDER BY fecha_alta DESC
        LIMIT 1`,
      [user.id]
    );
    if (!row.rowCount) return res.status(403).json({ error: 'Sin geriátrico asignado' });

    req.geriatricoId = row.rows[0].id_geriatrico;
    next();
  } catch (e) {
    console.error('tenant error:', e);
    res.status(500).json({ error: 'Error de contexto' });
  }
};

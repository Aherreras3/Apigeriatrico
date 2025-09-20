const db = require('../db');
const { handlePgError } = require('../utils/handle-error');

exports.listar = async (req, res) => {
  const user = req.user;
  const q = (req.query.q || '').trim();
  const page = Math.max(parseInt(req.query.page || '1'), 1);
  const size = Math.min(Math.max(parseInt(req.query.size || '20'), 1), 100);
  const offset = (page - 1) * size;

  try {
    if (user.is_superadmin) {
      const { rows } = await db.query(
        `SELECT id_geriatrico, nombre, ciudad
           FROM geriatrico
          WHERE ($1='' OR LOWER(nombre) LIKE LOWER($1)||'%' OR LOWER(ciudad) LIKE LOWER($1)||'%')
          ORDER BY nombre
          LIMIT $2 OFFSET $3`,
        [q, size, offset]
      );
      const total = (await db.query(
        `SELECT COUNT(*)::int AS total
           FROM geriatrico
          WHERE ($1='' OR LOWER(nombre) LIKE LOWER($1)||'%' OR LOWER(ciudad) LIKE LOWER($1)||'%')`,
        [q]
      )).rows[0].total;

      return res.json({ ok:true, data:{ items: rows, page, size, total } });
    }

    // admin/cuidador: solo sus centros
    const { rows } = await db.query(
      `SELECT g.id_geriatrico, g.nombre, g.ciudad
         FROM geriatrico g
         JOIN geriatrico_usuario gu
           ON gu.id_geriatrico=g.id_geriatrico AND gu.activo=TRUE
        WHERE gu.id_usuario=$1
          AND ($2='' OR LOWER(g.nombre) LIKE LOWER($2)||'%' OR LOWER(g.ciudad) LIKE LOWER($2)||'%')
        ORDER BY g.nombre
        LIMIT $3 OFFSET $4`,
      [user.id, q, size, offset]
    );
    const total = (await db.query(
      `SELECT COUNT(*)::int AS total
         FROM geriatrico g
         JOIN geriatrico_usuario gu
           ON gu.id_geriatrico=g.id_geriatrico AND gu.activo=TRUE
        WHERE gu.id_usuario=$1
          AND ($2='' OR LOWER(g.nombre) LIKE LOWER($2)||'%' OR LOWER(g.ciudad) LIKE LOWER($2)||'%')`,
      [user.id, q]
    )).rows[0].total;

    res.json({ ok:true, data:{ items: rows, page, size, total } });
  } catch (err) {
    return handlePgError(res, err, 'Error al listar geriátricos');
  }
};

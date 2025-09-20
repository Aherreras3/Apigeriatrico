const pool = require("../db");
const { handlePgError } = require('../utils/handle-error');

// controllers/seccion-controller.js
exports.crearSeccion = async (req, res) => {
  const { nombre, descripcion } = req.body || {};
  const idG = req.geriatricoId;

  if (!idG)   return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ error: 'nombre es requerido' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.crear_seccion($1,$2,$3)',
      [String(nombre).trim(), descripcion ?? null, idG]
    );
    return res.status(201).json({ mensaje: 'Sección creada con éxito', seccion: rows[0] });
  } catch (err) {
    // Útiles para depurar si hay constraint único por nombre, etc.
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una sección con ese nombre en este geriátrico.' });
    }
    console.error('POST /secciones error:', err?.code, err?.message);
    return handlePgError(res, err, 'Error al crear la sección');
  }
};

exports.obtenerSecciones = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.listar_secciones($1)',
      [req.geriatricoId]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener las secciones');
  }
};

// controllers/seccion-controller.js
exports.eliminarSeccion = async (req, res) => {
  const idG = req.geriatricoId;
  const id  = Number(req.params.id);
  if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo' });
  if (!id)  return res.status(400).json({ error: 'id inválido' });

  try {
    const { rows } = await pool.query(
      'SELECT public.eliminar_seccion($1,$2) AS r',
      [idG, id]
    );
    return res.json(rows[0].r);
  } catch (err) {
    // ⬇️ Captura específica de FK de nivel
    if (err?.code === '23503' && err?.constraint === 'nivel_id_seccion_fkey') {
      return res.status(409).json({
        error: 'No se puede eliminar la sección porque tiene niveles asociados. Elimina o reubica los niveles primero.'
      });
    }
    // (opcional) otros FKs que quieras tratar similar:
    // if (err?.code === '23503' && err?.constraint === 'test_seccion_id_seccion_fkey') { ... }

    console.error('Error al eliminar la sección:', err);
    return handlePgError(res, err, 'Error al eliminar la sección');
  }
};


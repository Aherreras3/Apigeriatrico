const pool = require('../db');
const { mapPgError } = require('../utils/pg-errors');
const { handlePgError } = require('../utils/handle-error');

/* ==================== CREAR ==================== */
const crearAdultoMayor = async (req, res) => {
  const {
    nombres, apellidos, tipo_identificacion, identificacion,
    fecha_nacimiento, sexo, observaciones,
  } = req.body || {};

  const id_cuidador   = req.user?.id;
  const id_geriatrico = req.geriatricoId;

  if (!id_cuidador)   return res.status(401).json({ error: 'Sesión inválida' });
  if (!id_geriatrico) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
  if (!nombres || !apellidos || !tipo_identificacion || !identificacion || !fecha_nacimiento || !sexo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.crear_adulto_mayor($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        nombres, apellidos, tipo_identificacion, identificacion,
        fecha_nacimiento, sexo, observaciones ?? null, id_cuidador, id_geriatrico,
      ]
    );
    const row = rows?.[0];
    return res.status(201).json({
      mensaje: 'Adulto mayor creado correctamente',
      id_adulto: row?.id_adulto,
      id_persona: row?.id_persona,
    });
  } catch (err) {
    const mapped = mapPgError(err);
    if (mapped && mapped.payload) {
      return res.status(mapped.status).json(mapped.payload);
    }
    return handlePgError(res, err, 'Error al crear adulto mayor');
  }
};

/* ==================== LISTAR ==================== */
const obtenerAdultosMayores = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

    const { rows } = await pool.query(
      `SELECT
          am.id_adulto, p.nombres, p.apellidos, p.tipo_identificacion,
          p.identificacion, p.fecha_nacimiento, p.sexo, am.observaciones
         FROM adulto_mayor am
         JOIN persona p ON p.id_persona = am.id_persona
        WHERE am.id_geriatrico = $1
        ORDER BY am.id_adulto DESC`,
      [idG]
    );

    return res.status(200).json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener adultos mayores');
  }
};

/* ==================== DETALLE ==================== */
const obtenerAdultoMayorPorId = async (req, res) => {
  const id_adulto     = Number(req.params.id);
  const id_geriatrico = req.geriatricoId;
  if (!id_adulto)     return res.status(400).json({ error: 'ID inválido' });
  if (!id_geriatrico) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.obtener_adulto_mayor_detalle($1::int,$2::int)`,
      [id_adulto, id_geriatrico]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    return res.json(row);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener detalle');
  }
};

/* ==================== ACTUALIZAR ==================== */
const actualizarAdultoMayor = async (req, res) => {
  const id_adulto     = Number(req.params.id);
  const id_geriatrico = req.geriatricoId;
  if (!id_adulto)     return res.status(400).json({ error: 'ID inválido' });
  if (!id_geriatrico) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

  const {
    nombres, apellidos, tipo_identificacion, identificacion,
    fecha_nacimiento, sexo, observaciones
  } = req.body || {};

  if (!nombres || !apellidos || !tipo_identificacion || !identificacion || !fecha_nacimiento || !sexo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT public.actualizar_adulto_mayor(
         $1::int, $2::int, $3::varchar, $4::varchar, $5::varchar,
         $6::varchar, $7::date, $8::varchar, $9::text
       ) AS ok`,
      [
        id_adulto, id_geriatrico, nombres, apellidos, tipo_identificacion,
        identificacion, fecha_nacimiento, sexo, (observaciones ?? null)
      ]
    );
    if (!rows?.[0]?.ok) return res.status(404).json({ error: 'No existe o contexto inválido' });
    return res.json({ mensaje: 'Adulto mayor actualizado' });
  } catch (err) {
    const mapped = mapPgError(err);
    if (mapped && mapped.payload) {
      return res.status(mapped.status).json(mapped.payload);
    }
    return handlePgError(res, err, 'Error al actualizar adulto mayor');
  }
};

/* ==================== ELIMINAR ==================== */
const eliminarAdultoMayor = async (req, res) => {
  const id_adulto     = Number(req.params.id);
  const id_geriatrico = req.geriatricoId;
  if (!id_adulto)     return res.status(400).json({ error: 'ID inválido' });
  if (!id_geriatrico) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

  try {
    const { rows } = await pool.query(
      `SELECT public.eliminar_adulto_mayor($1::int,$2::int) AS ok`,
      [id_adulto, id_geriatrico]
    );
    if (!rows?.[0]?.ok) return res.status(404).json({ error: 'No se pudo eliminar (no existe / contexto inválido)' });
    return res.json({ mensaje: 'Adulto mayor eliminado' });
  } catch (err) {
    return handlePgError(res, err, 'Error al eliminar adulto mayor');
  }
};

module.exports = {
  crearAdultoMayor,
  obtenerAdultosMayores,
  obtenerAdultoMayorPorId,
  actualizarAdultoMayor,
  eliminarAdultoMayor,
};

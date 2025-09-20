const pool = require('../db');
const { handlePgError } = require('../utils/handle-error');

/* ==============================
   TESTS (multi-tenant)
================================*/
const obtenerTests = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM test
        WHERE id_geriatrico = $1
        ORDER BY id_test DESC`,
      [req.geriatricoId]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener tests');
  }
};

const obtenerTestPorId = async (req, res) => {
  const idTest = parseInt(req.params.idTest, 10);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM test WHERE id_test=$1 AND id_geriatrico=$2',
      [idTest, req.geriatricoId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Test no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener test');
  }
};

const crearTest = async (req, res) => {
  const { titulo, descripcion } = req.body || {};
  const idG = req.geriatricoId;

  if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
  if (!titulo) return res.status(400).json({ error: 'titulo es requerido' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.crear_test($1,$2,$3,$4,$5)',
      [titulo, descripcion ?? null, req.user.id, idG, true]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return handlePgError(res, err, 'Error al crear el test');
  }
};

/* ==============================
   PARTICIPANTES
================================*/
const agregarParticipante = async (req, res) => {
  const idTest = parseInt(req.params.id, 10);
  const { id_adulto } = req.body;
  const idG = req.geriatricoId;

  if (!Number.isInteger(idTest) || !Number.isInteger(id_adulto)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }
  if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');

    const t = await cli.query('SELECT 1 FROM test WHERE id_test=$1 AND id_geriatrico=$2', [idTest, idG]);
    if (!t.rowCount) { await cli.query('ROLLBACK'); return res.status(404).json({ error: 'Test no encontrado en este geriátrico' }); }

    const a = await cli.query('SELECT 1 FROM adulto_mayor WHERE id_adulto=$1 AND id_geriatrico=$2', [id_adulto, idG]);
    if (!a.rowCount) { await cli.query('ROLLBACK'); return res.status(404).json({ error: 'Adulto no pertenece a este geriátrico' }); }

    const { rows } = await cli.query(
      'SELECT sp_agregar_participante($1,$2,$3,$4) AS id_progreso',
      [idTest, id_adulto, req.user.id, idG]
    );

    await cli.query('COMMIT');

    return res.status(201).json({
      ok: true,
      id_test: idTest,
      id_adulto,
      id_progreso: rows?.[0]?.id_progreso ?? null
    });
  } catch (err) {
    await cli.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'El adulto ya está asignado a este test' });
    return handlePgError(res, err, 'Error al agregar participante');
  } finally {
    cli.release();
  }
};

const listarParticipantesTest = async (req, res) => {
  const idTest = parseInt(req.params.idTest, 10);
  const idG = req.geriatricoId;

  if (!Number.isInteger(idTest)) return res.status(400).json({ error: 'Parámetro inválido' });
  if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

  try {
    const t = await pool.query('SELECT 1 FROM test WHERE id_test=$1 AND id_geriatrico=$2', [idTest, idG]);
    if (!t.rowCount) return res.status(404).json({ error: 'Test no encontrado en este geriátrico' });

    const { rows } = await pool.query('SELECT * FROM fn_listar_participantes_test($1)', [idTest]);
    return res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener participantes');
  }
};

const marcarParticipanteCompletado = async (req, res) => {
  const idTest = parseInt(req.params.idTest, 10);
  const idAdulto = parseInt(req.params.idAdulto, 10);
  const { completado = true } = req.body;

  try {
    const t = await pool.query('SELECT 1 FROM test WHERE id_test=$1 AND id_geriatrico=$2', [idTest, req.geriatricoId]);
    if (!t.rowCount) return res.status(403).json({ error: 'Fuera del geriátrico' });

    await pool.query('SELECT sp_marcar_completado($1,$2,$3)', [idTest, idAdulto, !!completado]);
    res.json({ ok: true });
  } catch (err) {
    return handlePgError(res, err, 'No se pudo actualizar el estado');
  }
};
const obtenerProgresoParticipante = async (req, res) => {
  const idTest = parseInt(req.params.idTest, 10);
  const idAdulto = parseInt(req.params.idAdulto, 10);

  try {
    // Validaciones de tenant
    const t = await pool.query('SELECT 1 FROM test WHERE id_test=$1 AND id_geriatrico=$2', [idTest, req.geriatricoId]);
    const a = await pool.query('SELECT 1 FROM adulto_mayor WHERE id_adulto=$1 AND id_geriatrico=$2', [idAdulto, req.geriatricoId]);
    if (!t.rowCount || !a.rowCount) return res.status(403).json({ error: 'Fuera del geriátrico' });

    // 1) Intentar la función nueva (detalle con cobertura + avance)
    try {
      const { rows } = await pool.query(
        'SELECT * FROM public.fn_progreso_participante_detalle($1,$2)',
        [idTest, idAdulto]
      );
      const r = rows?.[0];
      if (!r) return res.json(null);

      return res.json({
        nombre_completo: r.nombre_completo,
        total_ejercicios: r.total_ejercicios,
        ejercicios_respondidos: r.ejercicios_respondidos,
        porcentaje_cobertura: Number(r.porcentaje_cobertura ?? 0),
        porcentaje_avance: Number(r.porcentaje_avance ?? r.porcentaje_cobertura ?? 0),
        puntaje: r.puntaje == null ? null : Number(r.puntaje),
        realizado: r.completado === true,   // 👈 etiqueta amigable para el front
        fecha_fin: r.fecha_fin ?? null
      });
    } catch (e1) {
      // 2) Fallback: función antigua (solo "porcentaje" total)
      const { rows } = await pool.query(
        'SELECT * FROM fn_progreso_participante($1,$2)',
        [idTest, idAdulto]
      );
      if (!rows.length) return res.status(404).json({ error: 'No se encontró progreso para este participante.' });
      const r = rows[0];

      const cobertura = Number(r.porcentaje ?? 0);
      return res.json({
        nombre_completo: r.nombre_completo,
        total_ejercicios: r.total_ejercicios,
        ejercicios_respondidos: r.ejercicios_respondidos,
        porcentaje_cobertura: cobertura,  // 👈 mapeamos porcentaje -> cobertura
        porcentaje_avance: cobertura,     // 👈 sin la función nueva, usamos el mismo valor
        puntaje: null,                    // no disponible en la función antigua
        realizado: r.completado === true, // 👈 renombramos por consistencia visual
        fecha_fin: null
      });
    }
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener progreso');
  }
};


const eliminarParticipante = async (req, res) => {
  const idTest = parseInt(req.params.idTest, 10);
  const idAdulto = parseInt(req.params.idAdulto, 10);

  try {
    const t = await pool.query('SELECT 1 FROM test WHERE id_test=$1 AND id_geriatrico=$2', [idTest, req.geriatricoId]);
    const a = await pool.query('SELECT 1 FROM adulto_mayor WHERE id_adulto=$1 AND id_geriatrico=$2', [idAdulto, req.geriatricoId]);
    if (!t.rowCount || !a.rowCount) return res.status(403).json({ error: 'Fuera del geriátrico' });

    await pool.query('SELECT fn_eliminar_participante_test($1,$2)', [idAdulto, idTest]);
    res.json({ ok: true });
  } catch (err) {
    return handlePgError(res, err, 'Error al eliminar participante');
  }
};

/* ==============================
   SECCIONES DEL TEST
================================*/
// controllers/test-controller.js (solo este método)

const vincularSeccionATest = async (req, res) => {
  const idTest    = parseInt(req.params.id, 10);
  const idSeccion = Number((req.body || {}).id_seccion);
  const visible   = (req.body || {}).visible;
  const idG       = req.geriatricoId;
  const idU       = req.user?.id;

  if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
  if (!Number.isInteger(idTest) || !Number.isInteger(idSeccion)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  try {
    // Si visible === false => DESVINCULAR y poner ejercicios.id_test = NULL
    if (typeof visible === 'boolean' && visible === false) {
      const { rows } = await pool.query(
        `SELECT * FROM public.sp_desvincular_test_seccion($1,$2,$3)`,
        [idTest, idSeccion, idG]
      );
      const r = rows?.[0] || {};
      return res.status(200).json({
        ok: true,
        ocultada: !!r.ocultada,
        ejerciciosDesasignados: Number(r.ejercicios_desasignados ?? 0),
        action: 'unlinked'
      });
    }

    // Caso normal: vincular (y materializar ejercicios en el test)
    const { rows } = await pool.query(
      `SELECT public.sp_vincular_test_seccion_y_materializar($1,$2,$3,$4,$5) AS insertados`,
      [idTest, idSeccion, idG, idU, typeof visible === 'boolean' ? visible : true]
    );
    return res.status(200).json({ ok: true, insertados: rows?.[0]?.insertados ?? 0, action: 'linked' });

  } catch (err) {
    return handlePgError(res, err, 'No se pudo vincular/desvincular la sección');
  }
};


const listarSeccionesDeTest = async (req, res) => {
  const idTest = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query(
      `SELECT v.id_seccion, v.nombre, v.visible
         FROM vw_test_secciones v
        WHERE v.id_test=$1 AND v.id_geriatrico=$2 AND v.visible=TRUE
        ORDER BY v.nombre`,
      [idTest, req.geriatricoId]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'No se pudieron listar las secciones');
  }
};

const eliminarTest = async (req, res) => {
  const idG = req.geriatricoId;
  const idTest = parseInt(req.params.idTest || req.params.id, 10);

  if (!idG)   return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
  if (!idTest) return res.status(400).json({ error: 'ID inválido' });

  try {
    const { rows } = await pool.query(
      'SELECT public.eliminar_test($1,$2) AS r',
      [idTest, idG]
    );
    const r = rows?.[0]?.r || null;

    if (!r) return res.status(500).json({ error: 'Respuesta inválida del servidor' });

    if (r.not_found === true) {
      return res.status(404).json({ error: 'Test no encontrado en este geriátrico' });
    }

    if (r.ok === true) {
      return res.json({ ok: true });
    }

    // Bloqueos de negocio
    if (r.reason === 'participants') {
      return res.status(409).json({
        error: `No se puede eliminar: el test tiene ${r.count || 0} participante(s) asignado(s).`
      });
    }
    if (r.reason === 'sections') {
      return res.status(409).json({
        error: `No se puede eliminar: el test tiene ${r.count || 0} sección(es) vinculada(s).`
      });
    }

    // Fallback
    return res.status(400).json({ error: 'No se pudo eliminar el test' });
  } catch (err) {
    return handlePgError(res, err, 'Error al eliminar el test');
  }
};


module.exports = {
  obtenerTests,
  crearTest,
  obtenerTestPorId,
  agregarParticipante,
  listarParticipantesTest,
  marcarParticipanteCompletado,
  eliminarParticipante,
  obtenerProgresoParticipante,
  vincularSeccionATest,
  listarSeccionesDeTest,
  eliminarTest,
};

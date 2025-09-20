// controllers/movil-controller.js
'use strict';

const pool = require('../db');
const { handlePgError } = require('../utils/handle-error');

/* ===== helpers ===== */

async function esAdminAsync(req) {
  try {
    const u = req.user || {};
    if (u.is_superadmin) return true;

    const idG = req.geriatricoId;
    const idU = u.id;
    if (!idG || !idU) return false;

    const { rows } = await pool.query(
      `SELECT 1
         FROM geriatrico_usuario
        WHERE id_geriatrico = $1 AND id_usuario = $2 AND LOWER(rol) = 'admin'
        LIMIT 1`,
      [idG, idU]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// Helper admin para endpoints protegidos
async function denyIfNotAdmin(req, res) {
  const ok = await esAdminAsync(req);
  if (!ok) {
    res.status(403).json({ error: 'Solo administradores' });
    return true;
  }
  return false;
}

function iconUrlFromReq(req, id) {
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/movil/tienda/items/${id}/icon`;
}

/* ================== ADULTOS ================== */

const obtenerAdultosPorGeriatrico = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
    const { rows } = await pool.query('SELECT * FROM public.movil_obtener_adultos_por_geriatrico($1)', [idG]);
    return res.json(rows);
  } catch (err) { return handlePgError(res, err, 'Error al obtener adultos mayores'); }
};

const contarAdultosPorGeriatrico = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
    const { rows } = await pool.query('SELECT public.movil_contar_adultos_por_geriatrico($1) AS total', [idG]);
    return res.json({ total: rows?.[0]?.total ?? 0 });
  } catch (err) { return handlePgError(res, err, 'Error al contar adultos mayores'); }
};

const detalleAdultoMovil = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idAdulto = parseInt(req.params.idAdulto, 10);
    if (!idG || !Number.isInteger(idAdulto)) return res.status(400).json({ error: 'Parámetros inválidos' });
    const { rows } = await pool.query('SELECT * FROM public.movil_detalle_adulto($1,$2)', [idG, idAdulto]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json(rows[0]);
  } catch (err) { return handlePgError(res, err, 'Error al obtener detalle del adulto'); }
};

const nivelActualAdulto = async (req, res) => {
  try {
    const idAdulto = parseInt(req.params.idAdulto, 10);
    if (!Number.isInteger(idAdulto)) return res.status(400).json({ error: 'Parámetros inválidos' });
    const { rows } = await pool.query('SELECT * FROM public.movil_nivel_actual_adulto($1)', [idAdulto]);
    return res.json(rows?.[0] ?? null);
  } catch (err) { return handlePgError(res, err, 'Error al obtener nivel del adulto'); }
};

/* ======== Resumen / Actividad / Logros ======== */

const resumenAdultoMovil = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idAdulto = parseInt(req.params.idAdulto, 10);
    if (!idG || !Number.isInteger(idAdulto)) return res.status(400).json({ error: 'Parámetros inválidos' });
    const { rows } = await pool.query('SELECT * FROM public.movil_resumen_adulto($1,$2)', [idG, idAdulto]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json(rows[0]);
  } catch (err) { return handlePgError(res, err, 'Error al obtener resumen del adulto'); }
};

const actividadRecienteMovil = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idAdulto = parseInt(req.params.idAdulto, 10);
    const limit = parseInt(req.query.limit ?? '5', 10);
    if (!idG || !Number.isInteger(idAdulto)) return res.status(400).json({ error: 'Parámetros inválidos' });
    const { rows } = await pool.query('SELECT * FROM public.movil_actividad_reciente($1,$2,$3)', [idG, idAdulto, isNaN(limit) ? 5 : limit]);
    return res.json(rows);
  } catch (err) { return handlePgError(res, err, 'Error al obtener actividad reciente'); }
};

// NUEVO: devuelve icon_url para cada logro
const logrosAdultoMovil = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idAdulto = parseInt(req.params.idAdulto, 10);
    if (!idG || !Number.isInteger(idAdulto)) return res.status(400).json({ error: 'Parámetros inválidos' });

    const { rows } = await pool.query('SELECT * FROM public.movil_logros_adulto($1,$2)', [idG, idAdulto]);

    const base = `${req.protocol}://${req.get('host')}`;
    const data = rows.map(r => ({
      id_logro: r.id_logro,
      slug: r.slug,
      logro: r.logro,
      descripcion: r.descripcion,
      xp_bonus: r.xp_bonus,
      fecha: r.fecha,
      icon_url: (r.has_icono ? `${base}/movil/logros/${r.id_logro}/icon` : (r.icono_text || null)),
    }));
    return res.json(data);
  } catch (err) { return handlePgError(res, err, 'Error al obtener logros del adulto'); }
};

/* ================== PROGRESO ================== */

const resumenProgreso = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idU = req.user?.id;
    if (!idG || !idU) return res.status(400).json({ error: 'Falta geriátrico o usuario en sesión' });
    const isAdmin = await esAdminAsync(req);
    const { rows } = await pool.query('SELECT * FROM public.movil_resumen_progreso($1,$2,$3)', [idG, idU, isAdmin]);
    return res.json(rows);
  } catch (err) { return handlePgError(res, err, 'Error al obtener resumen de progreso'); }
};

const progresoPorAdulto = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idU = req.user?.id;
    const idAdulto = parseInt(req.params.idAdulto, 10);
    if (!idG || !idU || !Number.isInteger(idAdulto)) return res.status(400).json({ error: 'Parámetros inválidos' });
    const isAdmin = await esAdminAsync(req);
    const { rows } = await pool.query('SELECT * FROM public.movil_progreso_por_adulto($1,$2,$3,$4)', [idG, idU, isAdmin, idAdulto]);
    return res.json(rows);
  } catch (err) { return handlePgError(res, err, 'Error al obtener progreso del adulto'); }
};

/* ================== TESTS / EJERCICIOS ================== */

const testsDisponiblesMovil = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idU = req.user?.id;
    if (!idG || !idU) return res.status(400).json({ error: 'Falta geriátrico o usuario en sesión' });
    const isAdmin = await esAdminAsync(req);
    const { rows } = await pool.query('SELECT * FROM public.movil_tests_disponibles($1,$2,$3)', [idG, idU, isAdmin]);
    return res.json(rows);
  } catch (err) { return handlePgError(res, err, 'Error al obtener tests disponibles'); }
};

const personasConTestMovil = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

    const { rows } = await pool.query(
      `SELECT am.id_adulto,
              per.id_persona,
              per.nombres,
              per.apellidos,
              COUNT(pt.id_progreso) AS total_tests
         FROM adulto_mayor am
         JOIN persona per
           ON per.id_persona = am.id_persona
         JOIN progreso_test pt
           ON pt.id_adulto = am.id_adulto
          AND pt.id_geriatrico = $1
        WHERE am.id_geriatrico = $1
        GROUP BY am.id_adulto, per.id_persona, per.nombres, per.apellidos
        ORDER BY per.apellidos, per.nombres`,
      [idG]
    );

    return res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener personas con test');
  }
};


const ejerciciosPorTestMovil = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idTest = parseInt(req.params.idTest, 10);
    if (!idG || !Number.isInteger(idTest)) return res.status(400).json({ error: 'Parámetros inválidos' });
    const { rows } = await pool.query('SELECT * FROM public.movil_ejercicios_por_test($1,$2)', [idTest, idG]);
    return res.json(rows);
  } catch (err) { return handlePgError(res, err, 'Error al obtener ejercicios del test'); }
};

const estadoTestMovil = async (req, res) => {
  try {
    const idTest = parseInt(req.params.idTest, 10);
    const idAdulto = parseInt(req.params.idAdulto, 10);
    const idG = req.geriatricoId;
    const idU = req.user?.id;
    if (!idG || !idU || !Number.isInteger(idTest) || !Number.isInteger(idAdulto)) return res.status(400).json({ error: 'Parámetros inválidos' });
    const isAdmin = await esAdminAsync(req);
    const { rows } = await pool.query('SELECT * FROM public.movil_estado_test_por_nivel($1,$2,$3,$4)', [idTest, idAdulto, idG, isAdmin]);
    return res.json(rows);
  } catch (err) { return handlePgError(res, err, 'Error al obtener estado del test'); }
};

/* =============== INTENTOS =============== */

const crearIntentoMovil = async (req, res) => {
  try {
    const idTest = parseInt(req.params.idTest, 10);
    const { idAdulto, tipo = 'graded' } = req.body || {};
    if (!Number.isInteger(idTest) || !Number.isInteger(idAdulto)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }
    const { rows } = await pool.query('SELECT * FROM public.sp_crear_intento($1,$2,$3);', [idTest, idAdulto, tipo]);
    return res.status(201).json(rows?.[0] ?? {});
  } catch (err) { return handlePgError(res, err, 'Error al crear intento'); }
};

const registrarRespuestaIntentoMovil = async (req, res) => {
  try {
    const idProgreso = parseInt(req.params.idProgreso, 10);
    const body = req.body || {};
    const idEjercicio = Number(body.idEjercicio ?? body.id_ejercicio);
    const evaluacion = Number(body.evaluacion) || 0;
    const tiempoSegundos = Number(body.tiempoSegundos ?? body.tiempo_segundos ?? 0);
    const respuesta = (body.respuesta ?? '').toString();

    if (!Number.isInteger(idProgreso) || !Number.isInteger(idEjercicio)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM public.sp_registrar_respuesta($1,$2,$3,$4,$5);',
      [idProgreso, idEjercicio, evaluacion, tiempoSegundos, respuesta]
    );

    await pool.query('SELECT public.sp_revisar_bloqueo_por_intentos($1,$2);', [idProgreso, 5]);

    const { rows: rTest } = await pool.query('SELECT id_test FROM progreso_test WHERE id_progreso = $1', [idProgreso]);

    return res.status(201).json({
      id_progreso: idProgreso,
      id_test: rTest?.[0]?.id_test ?? null,
      total_ejercicios: rows?.[0]?.total_ejercicios ?? 0,
      ejercicios_respondidos: rows?.[0]?.ejercicios_respondidos ?? 0,
      orden_nivel_actual: rows?.[0]?.orden_nivel_actual ?? null,
    });
  } catch (err) { return handlePgError(res, err, 'Error al registrar respuesta del intento'); }
};

const cerrarIntentoMovil = async (req, res) => {
  try {
    const idProgreso = parseInt(req.params.idProgreso, 10);
    if (!Number.isInteger(idProgreso)) return res.status(400).json({ error: 'Parámetros inválidos' });

    // Cierra el intento
    const { rows } = await pool.query('SELECT * FROM public.sp_cerrar_intento($1);', [idProgreso]);
    const cierre = rows?.[0] ?? {};

    // Lee datos del intento recién cerrado
    const { rows: rInfo } = await pool.query(
      `SELECT id_geriatrico, id_adulto, id_test, completado, puntaje
         FROM progreso_test
        WHERE id_progreso = $1`,
      [idProgreso]
    );

    let nuevosLogros = [];
    const info = rInfo?.[0];
    if (info?.completado === true) {
      const { rows: rLogros } = await pool.query(
        `SELECT * FROM public.sp_logros_evaluar_evento($1,$2,'test_completed',$3,$4,$5)`,
        [info.id_geriatrico, info.id_adulto, info.id_test, info.puntaje, idProgreso]
      );
      nuevosLogros = rLogros || [];
    }

    return res.status(200).json({ ...cierre, nuevos_logros: nuevosLogros });
  } catch (err) {
    return handlePgError(res, err, 'Error al cerrar intento');
  }
};


/* ======= Legacy ======= */

const responderEjercicioMovil = async (req, res) => {
  try {
    const idEjercicio = parseInt(req.params.idEjercicio, 10);
    const idG = req.geriatricoId;
    const body = req.body || {};
    const idAdulto = Number(body.id_adulto);
    const evaluacion = Number(body.evaluacion) || 0;
    const tiempo = Number(body.tiempo_segundos ?? body.tiempo_seg ?? 0);
    const respuesta = (body.respuesta ?? '').toString();

    if (body.id_progreso) {
      req.params.idProgreso = String(body.id_progreso);
      req.body = { idEjercicio, evaluacion, tiempoSegundos: tiempo, respuesta };
      return registrarRespuestaIntentoMovil(req, res);
    }

    if (!idG || !Number.isInteger(idEjercicio) || !Number.isInteger(idAdulto)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    await pool.query('SELECT public.movil_registrar_respuesta($1,$2,$3,$4,$5,$6)', [idEjercicio, idAdulto, evaluacion, tiempo, idG, respuesta]);

    const { rows: rTest } = await pool.query(
      `SELECT id_test FROM ejercicio WHERE id_ejercicio = $1 AND id_geriatrico = $2`,
      [idEjercicio, idG]
    );
    if (!rTest.length) return res.status(201).json({ ok: true });

    const idTest = rTest[0].id_test;

    const { rows: rProg } = await pool.query(
      `SELECT id_progreso, id_adulto, id_test, completado, fecha_inicio, fecha_fin,
              id_cuidador_asignador, id_geriatrico, puntaje
         FROM progreso_test
        WHERE id_adulto = $1 AND id_test = $2 AND id_geriatrico = $3
        ORDER BY COALESCE(fecha_fin, fecha_inicio) DESC, id_progreso DESC
        LIMIT 1`,
      [idAdulto, idTest, idG]
    );

    let estadoNivel = null;
    try {
      const isAdmin = await esAdminAsync(req);
      const { rows: rEstado } = await pool.query(
        'SELECT * FROM public.movil_estado_test_por_nivel($1,$2,$3,$4)',
        [idTest, idAdulto, idG, isAdmin]
      );
      estadoNivel = rEstado;
    } catch (_) {}

    return res.status(201).json({
      ok: true,
      id_test: idTest,
      progreso: rProg?.[0] ?? null,
      realizado: (rProg?.[0]?.completado === true),
      estado_nivel: estadoNivel,
    });
  } catch (err) { return handlePgError(res, err, 'Error al registrar respuesta'); }
};

/* ================== TIENDA ================== */

// Lista de ítems (construye icon_url)
const tiendaItems = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_item, nombre, costo_xp, categoria, descripcion, activo,
              (icono_binario IS NOT NULL) AS has_icono
         FROM tienda_item
        WHERE activo = true
        ORDER BY id_item DESC`
    );

    const base = `${req.protocol}://${req.get('host')}`;
    const data = rows.map(r => ({
      ...r,
      icon_url: r.has_icono ? `${base}/movil/tienda/items/${r.id_item}/icon` : null,
    }));

    return res.json(data);
  } catch (err) {
    return handlePgError(res, err, 'Error al listar ítems de tienda');
  }
};

const tiendaRedimir = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idAdulto = parseInt(req.body?.idAdulto ?? req.query.idAdulto, 10);
    const idItem = parseInt(req.body?.idItem ?? req.query.idItem, 10);
    if (!idG || !Number.isInteger(idAdulto) || !Number.isInteger(idItem)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }
    const { rows } = await pool.query('SELECT * FROM public.sp_tienda_redimir($1,$2,$3)', [idG, idAdulto, idItem]);
    return res.status(201).json(rows?.[0] ?? { exito: false });
  } catch (err) { return handlePgError(res, err, 'Error al redimir ítem'); }
};

const tiendaHistorial = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idAdulto = parseInt(req.params.idAdulto, 10);
    const limit = parseInt(req.query.limit ?? '20', 10);
    if (!idG || !Number.isInteger(idAdulto)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }
    const { rows } = await pool.query('SELECT * FROM public.sp_tienda_historial($1,$2,$3)', [idG, idAdulto, isNaN(limit) ? 20 : limit]);
    return res.json(rows);
  } catch (err) { return handlePgError(res, err, 'Error al obtener historial de tienda'); }
};

const xpSaldoAdulto = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const idAdulto = parseInt(req.params.idAdulto, 10);
    if (!idG || !Number.isInteger(idAdulto)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }
    const { rows } = await pool.query('SELECT public.movil_xp_saldo($1,$2) AS saldo', [idG, idAdulto]);
    return res.json({ saldo: rows?.[0]?.saldo ?? 0 });
  } catch (err) { return handlePgError(res, err, 'Error al obtener saldo XP'); }
};

// Admin list (?q=...&all=1)
const tiendaAdminList = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const all = (req.query.all || '0') === '1';

    const params = [];
    const where = [];
    if (!all) where.push('ti.activo = true');
    if (q) { params.push(`%${q}%`); where.push('(lower(ti.nombre) LIKE $1 OR lower(ti.categoria) LIKE $1)'); }

    const { rows } = await pool.query(
      `SELECT ti.id_item, ti.nombre, ti.costo_xp, ti.categoria, ti.descripcion, ti.activo,
              (ti.icono_binario IS NOT NULL) AS has_icono
         FROM tienda_item ti
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY ti.id_item DESC`,
      params
    );

    const data = rows.map(r => ({ ...r, icon_url: r.has_icono ? iconUrlFromReq(req, r.id_item) : null }));
    return res.json(data);
  } catch (err) { return handlePgError(res, err, 'Error al listar ítems (admin)'); }
};

// Crear ítem
const tiendaAdminCreate = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;
    const b = req.body || {};
    const nombre = (b.nombre || '').toString().trim();
    const costoXp = Number(b.costo_xp ?? b.costoXp ?? 0);
    const categoria = b.categoria?.toString() ?? null;
    const descripcion = b.descripcion?.toString() ?? null;
    const activo = (b.activo === 'true' || b.activo === true);

    if (!nombre || !Number.isFinite(costoXp) || costoXp <= 0) {
      return res.status(400).json({ error: 'nombre y costo_xp son obligatorios' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Debes subir una imagen (campo: icono_file)' });
    }

    const { buffer, mimetype, originalname } = req.file;

    const { rows } = await pool.query(
      `INSERT INTO tienda_item (nombre, costo_xp, categoria, descripcion, activo,
                                icono_binario, icono_mime, icono_nombre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id_item, nombre, costo_xp, categoria, descripcion, activo,
                 (icono_binario IS NOT NULL) AS has_icono`,
      [nombre, costoXp, categoria, descripcion, activo, buffer, mimetype, originalname]
    );

    const r = rows[0];
    r.icon_url = r.has_icono ? iconUrlFromReq(req, r.id_item) : null;
    return res.status(201).json(r);
  } catch (err) { return handlePgError(res, err, 'Error al crear ítem'); }
};

// Update ítem
const tiendaAdminUpdate = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });

    const b = req.body || {};
    const sets = [];
    const params = [];
    const push = (frag, val) => { sets.push(frag); params.push(val); };

    if (b.nombre !== undefined)      push('nombre = $' + (params.length + 1), b.nombre.toString());
    if (b.costo_xp !== undefined)    push('costo_xp = $' + (params.length + 1), Number(b.costo_xp ?? b.costoXp));
    if (b.categoria !== undefined)   push('categoria = $' + (params.length + 1), b.categoria?.toString() ?? null);
    if (b.descripcion !== undefined) push('descripcion = $' + (params.length + 1), (b.descripcion ?? '').toString());
    if (b.activo !== undefined)      push('activo = $' + (params.length + 1), (b.activo === 'true' || b.activo === true));

    if (req.file) {
      push('icono_binario = $' + (params.length + 1), req.file.buffer);
      push('icono_mime    = $' + (params.length + 1), req.file.mimetype);
      push('icono_nombre  = $' + (params.length + 1), req.file.originalname);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });

    const { rows } = await pool.query(
      `UPDATE tienda_item SET ${sets.join(', ')} WHERE id_item = $${params.length + 1}
       RETURNING id_item, nombre, costo_xp, categoria, descripcion, activo,
                 (icono_binario IS NOT NULL) AS has_icono`,
      [...params, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    const r = rows[0];
    r.icon_url = r.has_icono ? iconUrlFromReq(req, r.id_item) : null;
    return res.json(r);
  } catch (err) { return handlePgError(res, err, 'Error al actualizar ítem'); }
};

// Delete (soft)
const tiendaAdminDelete = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
    const { rows } = await pool.query(
      `UPDATE tienda_item SET activo = false WHERE id_item = $1 RETURNING id_item`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json({ ok: true });
  } catch (err) { return handlePgError(res, err, 'Error al eliminar ítem'); }
};

// Icon binario tienda
const tiendaIcon = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).send('id inválido');
    const { rows } = await pool.query(
      `SELECT icono_binario, icono_mime FROM tienda_item WHERE id_item = $1`,
      [id]
    );
    if (!rows.length || !rows[0].icono_binario) return res.status(404).send('no icon');
    res.setHeader('Content-Type', rows[0].icono_mime || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(rows[0].icono_binario);
  } catch (_) { return res.status(500).send('error'); }
};

/* ===== Ranking XP ===== */

const rankingXp = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    const limit = parseInt(req.query.limit ?? '20', 10);
    if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo' });
    const { rows } = await pool.query('SELECT * FROM public.movil_ranking_xp($1,$2)', [idG, isNaN(limit) ? 20 : limit]);
    return res.json(rows);
  } catch (err) { return handlePgError(res, err, 'Error al obtener ranking XP'); }
};

/* ================== LOGROS (iconos + admin) ================== */

// Icono público del logro
const logroIcon = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).send('id inválido');
    const { rows } = await pool.query(
      `SELECT icono_binario, icono_mime FROM logros WHERE id_logro = $1`,
      [id]
    );
    if (!rows.length || !rows[0].icono_binario) return res.status(404).send('no icon');
    res.setHeader('Content-Type', rows[0].icono_mime || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(rows[0].icono_binario);
  } catch (_) { return res.status(500).send('error'); }
};

module.exports = {
  // Adultos
  obtenerAdultosPorGeriatrico,
  contarAdultosPorGeriatrico,
  detalleAdultoMovil,
  nivelActualAdulto,
  resumenAdultoMovil,
  actividadRecienteMovil,

  // Progreso
  resumenProgreso,
  progresoPorAdulto,

  // Tests / ejercicios
  testsDisponiblesMovil,
  personasConTestMovil,
  ejerciciosPorTestMovil,
  estadoTestMovil,

  // Logros
  logrosAdultoMovil,

  // Intentos
  crearIntentoMovil,
  registrarRespuestaIntentoMovil,
  cerrarIntentoMovil,
  progresoParticipanteDetalleMovil: async (req, res) => {
    try {
      const idTest = parseInt(req.params.idTest, 10);
      const idAdulto = parseInt(req.params.idAdulto, 10);
      if (!Number.isInteger(idTest) || !Number.isInteger(idAdulto)) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
      }
      const { rows } = await pool.query('SELECT * FROM public.fn_progreso_participante_detalle($1,$2);', [idTest, idAdulto]);
      return res.json(rows?.[0] ?? {});
    } catch (err) { return handlePgError(res, err, 'Error al obtener progreso del participante'); }
  },

  // Legacy
  responderEjercicioMovil,

  // XP
  xpSaldoAdulto,
  rankingXp,

  // Tienda pública/protegida
  tiendaItems,
  tiendaRedimir,
  tiendaHistorial,

  // Tienda admin
  tiendaAdminList,
  tiendaAdminCreate,
  tiendaAdminUpdate,
  tiendaAdminDelete,
  tiendaIcon,

  // Logros (icon)
  logroIcon,
};

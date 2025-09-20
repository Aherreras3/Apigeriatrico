// controllers/reportes-controller.js
'use strict';

const pool = require('../db');
const { handlePgError } = require('../utils/handle-error');

// === helper admin (mismo criterio que usas en movil-controller) ===
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
async function denyIfNotAdmin(req, res) {
  const ok = await esAdminAsync(req);
  if (!ok) {
    res.status(403).json({ error: 'Solo administradores' });
    return true;
  }
  return false;
}

// ================== REPORTE COMBINADO ==================
exports.ejecucionTestsConPromedio = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;

    const idG = req.geriatricoId;
    if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en sesión' });

    // from/to (tope EXCLUSIVO): si envían sólo fecha, añado hora
    const fromRaw = (req.query.from ?? '1900-01-01').toString();
    const toRaw   = (req.query.to   ?? '2999-12-31').toString();

    const fromTs = fromRaw.includes(':') ? fromRaw : `${fromRaw} 00:00:00`;
    // si te mandan 'to' como fecha, calcula el exclusivo desde Node sumando 1 día
    const toTsExclusive = toRaw.includes(':') ? toRaw : `${toRaw} 00:00:00`;

    const { rows } = await pool.query(
      `SELECT public.fn_reporte_ejecucion_tests_combined($1, $2::timestamp, $3::timestamp) AS result`,
      [idG, fromTs, toTsExclusive]
    );

    const payload = rows?.[0]?.result ?? { resumen: [], detalle: [] };
    return res.json(payload);
  } catch (err) {
    return handlePgError(res, err, 'Error al generar reporte combinado');
  }
};

// controllers/reportes-controller.js
exports.participacionPorAdulto = async (req,res)=>{
  try{
    if (await denyIfNotAdmin(req,res)) return;
    const idG = req.geriatricoId;
    const from = (req.query.from ?? '1900-01-01')+' 00:00:00';
    const to   = (req.query.to   ?? '2999-12-31')+' 00:00:00';
    const { rows } = await pool.query(
      'SELECT * FROM public.fn_rep_participacion_adulto($1,$2::timestamp,$3::timestamp)',
      [idG, from, to]
    );
    res.json(rows);
  }catch(err){ return handlePgError(res,err,'Error en participación por adulto'); }
};
exports.desempenoSeccionNivel = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;
    const idG  = req.geriatricoId;
    const from = (req.query.from ?? '1900-01-01') + ' 00:00:00';
    const to   = (req.query.to   ?? '2999-12-31') + ' 00:00:00';

    const { rows } = await pool.query(
      'SELECT * FROM public.fn_rep_desempeno_seccion_nivel($1,$2::timestamp,$3::timestamp)',
      [idG, from, to]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error en desempeño por sección/nivel');
  }
};

// controllers/reportes-controller.js
exports.desempenoSeccionNivel = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;
    const idG  = req.geriatricoId;
    const from = (req.query.from ?? '1900-01-01') + ' 00:00:00';
    const to   = (req.query.to   ?? '2999-12-31') + ' 00:00:00';

    const { rows } = await pool.query(
      'SELECT * FROM public.fn_rep_desempeno_seccion_nivel($1,$2::timestamp,$3::timestamp)',
      [idG, from, to]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error en desempeño por sección/nivel');
  }
};

exports.seccionesUso = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;
    const idG  = req.geriatricoId;
    const from = (req.query.from ?? '1900-01-01') + ' 00:00:00';
    const to   = (req.query.to   ?? '2999-12-31') + ' 00:00:00';

    const { rows } = await pool.query(
      'SELECT * FROM public.fn_rep_secciones_uso($1,$2::timestamp,$3::timestamp)',
      [idG, from, to]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error en secciones más utilizadas');
  }
};

// ... arriba ya tienes imports, pool, handlePgError, denyIfNotAdmin, etc.

exports.cuidadores = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;

    const idG  = req.geriatricoId;
    const from = (req.query.from ?? '1900-01-01') + ' 00:00:00';
    const to   = (req.query.to   ?? '2999-12-31') + ' 00:00:00';

    const { rows } = await pool.query(
      'SELECT * FROM public.fn_rep_cuidadores($1,$2::timestamp,$3::timestamp)',
      [idG, from, to]
    );
    return res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error en reporte de cuidadores');
  }
};
// controllers/reportes-controller.js
// controllers/reportes-controller.js
exports.progresoTiempo = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;

    const idG = req.geriatricoId;
    if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

    const from = (req.query.from ?? '1900-01-01') + ' 00:00:00';
    const to   = (req.query.to   ?? '2999-12-31') + ' 00:00:00';

    const bucketRaw = (req.query.bucket ?? 'week').toString().toLowerCase();
    const bucket = ['day','week','month'].includes(bucketRaw) ? bucketRaw : 'week';

    const { rows } = await pool.query(
      'SELECT * FROM public.fn_rep_progreso_tiempo($1,$2::timestamp,$3::timestamp,$4::text)',
      [idG, from, to, bucket]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error en progreso en el tiempo');
  }
};

exports.abandono = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;
    const idG = req.geriatricoId;
    const from = (req.query.from ?? '1900-01-01') + ' 00:00:00';
    const to   = (req.query.to   ?? '2999-12-31') + ' 00:00:00';
    const { rows } = await pool.query(
      'SELECT public.fn_rep_abandono($1,$2::timestamp,$3::timestamp) AS result',
      [idG, from, to]
    );
    res.json(rows?.[0]?.result ?? { por_adulto: [], por_test: [] });
  } catch (err) {
    return handlePgError(res, err, 'Error en reporte de abandono');
  }
};


exports.frecuenciaUso = async (req, res) => {
  try {
    if (await denyIfNotAdmin(req, res)) return;
    const idG = req.geriatricoId;
    const from = (req.query.from ?? '1900-01-01') + ' 00:00:00';
    const to   = (req.query.to   ?? '2999-12-31') + ' 00:00:00';
    const { rows } = await pool.query(
      'SELECT * FROM public.fn_rep_frecuencia_uso($1,$2::timestamp,$3::timestamp)',
      [idG, from, to]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error en frecuencia de uso');
  }
};



const pool = require('../db');
const multer = require('multer');
const { handlePgError } = require('../utils/handle-error');
const { mapPgError } = require('../utils/pg-errors');

// ---- upload (imagen en memoria) ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});
exports.uploadIcon = upload.single('icono_file');

// ---- helpers ----
const slugify = (s='') =>
  String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

async function uniqueSlug(base) {
  let cand = base || 'logro';
  let i = 2;
  // si existe, agrega -2, -3, ...
  while (true) {
    const { rows } = await pool.query('SELECT 1 FROM public.logros WHERE slug=$1 LIMIT 1', [cand]);
    if (!rows.length) return cand;
    cand = `${base}-${i++}`;
  }
}

function parseRegla(body) {
  // acepta regla JSON completa o (regla_tipo + regla_min)
  try {
    if (body.regla) return typeof body.regla === 'string' ? JSON.parse(body.regla) : body.regla;
  } catch (_) {}
  const tipo = body.regla_tipo || body.tipo;
  const r = tipo ? { tipo: String(tipo) } : {};
  const m = body.regla_min ?? body.min;
  if (m !== undefined && m !== '') {
    const v = Number(m);
    if (!Number.isNaN(v)) r.min = v;
  }
  return r;
}

// ADMIN o SUPERADMIN del geriátrico activo (usa tus middlewares previos)
async function ensureAdmin(req, res) {
  try {
    const idU = req.user?.id;
    const idG = req.geriatricoId;
    if (!idU) { res.status(401).json({ error: 'No autenticado' }); return false; }
    if (!idG) { res.status(400).json({ error: 'Selecciona un geriátrico' }); return false; }
    if (req.user.is_superadmin) return true;

    const { rows } = await pool.query(
      `SELECT rol, activo
         FROM geriatrico_usuario
        WHERE id_usuario=$1 AND id_geriatrico=$2
        LIMIT 1`,
      [idU, idG]
    );
    const r = rows[0];
    const ok = r && r.activo && String(r.rol||'').toLowerCase()==='admin';
    if (!ok) { res.status(403).json({ error: 'Solo administradores' }); return false; }
    return true;
  } catch (e) {
    return handlePgError(res, e, 'Error verificando rol');
  }
}

// ------------- ICONO (stream binario) -------------
exports.icon = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT icono_mime, icono_binario FROM public.logros WHERE id_logro=$1',
      [req.params.id]
    );
    const r = rows[0];
    if (!r || !r.icono_binario) return res.status(404).end();
    res.setHeader('Content-Type', r.icono_mime || 'application/octet-stream');
    res.send(r.icono_binario);
  } catch (err) {
    return handlePgError(res, err, 'No se pudo obtener el icono');
  }
};

// ------------- LISTAR -------------
exports.list = async (req, res) => {
  if (!(await ensureAdmin(req, res))) return;

  // probe rápido para tu patrón del front
  if (req.query.__probe === '1') return res.json([]);

  try {
    const q = (req.query.q || '').toString();
    const includeAll = req.query.all === '1' || req.query.all === 'true';

    const params = [];
    let where = 'WHERE 1=1';
    if (!includeAll) where += ' AND activo = TRUE';
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (LOWER(titulo) LIKE LOWER($${params.length}) OR LOWER(descripcion) LIKE LOWER($${params.length}))`;
    }

    const { rows } = await pool.query(
      `SELECT id_logro, titulo, descripcion, slug, xp_bonus, activo, regla
         FROM public.logros
        ${where}
        ORDER BY id_logro DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error listando logros');
  }
};

// ------------- OBTENER UNO -------------
exports.getOne = async (req, res) => {
  if (!(await ensureAdmin(req, res))) return;
  try {
    const { rows } = await pool.query('SELECT * FROM public.logros WHERE id_logro=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No existe' });
    res.json(rows[0]);
  } catch (err) {
    return handlePgError(res, err, 'Error obteniendo logro');
  }
};

// ------------- CREAR -------------
exports.create = async (req, res) => {
  if (!(await ensureAdmin(req, res))) return;
  try {
    const { titulo, descripcion, xp_bonus, activo, slug } = req.body;
    if (!titulo) return res.status(400).json({ error: 'titulo es requerido' });

    const regla = parseRegla(req.body);
    const file = req.file || null;

    const baseSlug = slug ? slugify(slug) : slugify(titulo);
    const finalSlug = await uniqueSlug(baseSlug);

    const { rows } = await pool.query(
      `INSERT INTO public.logros
         (titulo, descripcion, icono, slug, xp_bonus, icono_mime, icono_nombre, icono_binario, activo, regla)
       VALUES
         ($1,$2,'',$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        String(titulo),
        descripcion ?? '',
        finalSlug,
        xp_bonus != null ? Number(xp_bonus) : 0,
        file?.mimetype || null,
        file?.originalname || null,
        file?.buffer || null,
        activo === undefined ? true : (String(activo) === 'true'),
        regla || {}
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    const mapped = mapPgError(err);
    return res.status(mapped.status).json(mapped.payload);
  }
};

// ------------- ACTUALIZAR -------------
exports.update = async (req, res) => {
  if (!(await ensureAdmin(req, res))) return;
  try {
    const id = Number(req.params.id);
    const { titulo, descripcion, xp_bonus, activo, slug, clear_icon } = req.body;
    const file = req.file || null;
    const regla = parseRegla(req.body);

    // obtener actual
    const cur = await pool.query('SELECT * FROM public.logros WHERE id_logro=$1', [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'No existe' });
    const r = cur.rows[0];

    // slug
    let newSlug = r.slug;
    if (slug || titulo) {
      const base = slugify(slug || titulo);
      if (base && base !== r.slug) newSlug = await uniqueSlug(base);
    }

    const { rows } = await pool.query(
      `UPDATE public.logros SET
          titulo        = COALESCE($2, titulo),
          descripcion   = COALESCE($3, descripcion),
          slug          = $4,
          xp_bonus      = COALESCE($5, xp_bonus),
          activo        = COALESCE($6, activo),
          regla         = COALESCE($7, regla),
          icono_mime    = COALESCE($8, icono_mime),
          icono_nombre  = COALESCE($9, icono_nombre),
          icono_binario = CASE
                            WHEN $10::bool THEN NULL
                            WHEN $11::bytea IS NOT NULL THEN $11
                            ELSE icono_binario
                          END
        WHERE id_logro = $1
        RETURNING *`,
      [
        id,
        (typeof titulo === 'undefined') ? null : titulo,
        (typeof descripcion === 'undefined') ? null : descripcion,
        newSlug,
        (typeof xp_bonus === 'undefined') ? null : Number(xp_bonus),
        (typeof activo === 'undefined') ? null : (String(activo) === 'true'),
        Object.keys(regla || {}).length ? regla : null,
        file?.mimetype || null,
        file?.originalname || null,
        clear_icon === '1' || clear_icon === 'true',
        file?.buffer || null
      ]
    );

    res.json(rows[0]);
  } catch (err) {
    const mapped = mapPgError(err);
    return res.status(mapped.status).json(mapped.payload);
  }
};

// ------------- (DES)ACTIVAR / ELIMINAR LÓGICO -------------
exports.softDelete = async (req, res) => {
  if (!(await ensureAdmin(req, res))) return;
  try {
    const { rows } = await pool.query(
      'UPDATE public.logros SET activo=false WHERE id_logro=$1 RETURNING *',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No existe' });
    res.json(rows[0]);
  } catch (err) {
    return handlePgError(res, err, 'No se pudo desactivar');
  }
};

exports.activate = async (req, res) => {
  if (!(await ensureAdmin(req, res))) return;
  try {
    const { rows } = await pool.query(
      'UPDATE public.logros SET activo=true WHERE id_logro=$1 RETURNING *',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No existe' });
    res.json(rows[0]);
  } catch (err) {
    return handlePgError(res, err, 'No se pudo activar');
  }
};

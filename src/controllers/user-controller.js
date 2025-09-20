// controllers/user-controller.js
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { handlePgError } = require('../utils/handle-error');
const { mapPgError } = require('../utils/pg-errors');

let COOKIE_NAME = 'token';
let COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', secure: false, path: '/' };
try {
  const fromAuth = require('./authController');
  if (fromAuth.COOKIE_NAME) COOKIE_NAME = fromAuth.COOKIE_NAME;
  if (fromAuth.COOKIE_OPTS) Object.assign(COOKIE_OPTS, fromAuth.COOKIE_OPTS);
} catch (_) {}

const isBcrypt = (s) => typeof s === 'string' && /^\$2[aby]\$/.test(s);

/* =========================
   LOGIN (SIN CAMBIOS)
========================== */
exports.loginUser = async (req, res) => {
  const { usuario, correo, password, contrasena } = req.body;
  const loginId = (usuario || correo || '').toLowerCase().trim();
  const passPlain = (password ?? contrasena ?? '').toString();

  if (!loginId || !passPlain) {
    return res.status(400).json({ mensaje: 'Usuario/correo y contraseña son requeridos' });
  }

  try {
    const result = await pool.query(
      `SELECT u.*
         FROM usuario u
        WHERE LOWER(u.usuario) = $1 OR LOWER(u.correo) = $1
        LIMIT 1`,
      [loginId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
    }

    const user = result.rows[0];

    let ok = false;
    if (isBcrypt(user.contrasena)) {
      ok = await bcrypt.compare(passPlain, user.contrasena);
    } else {
      ok = passPlain === user.contrasena;
      if (ok) {
        const newHash = await bcrypt.hash(passPlain, 10);
        await pool.query('UPDATE usuario SET contrasena = $1 WHERE id_usuario = $2', [newHash, user.id_usuario]);
        user.contrasena = newHash;
      }
    }
    if (!ok) return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });

    const gs = await pool.query(
      `SELECT g.id_geriatrico, g.nombre, gu.rol, gu.activo
         FROM geriatrico_usuario gu
         JOIN geriatrico g ON g.id_geriatrico = gu.id_geriatrico
        WHERE gu.id_usuario = $1
        ORDER BY g.nombre`,
      [user.id_usuario]
    );
    const geriatricoList = gs.rows;
    const active = !user.is_superadmin
      ? (geriatricoList.find(x => x.activo) || geriatricoList[0] || null)
      : null;

    const token = jwt.sign(
      { id: user.id_usuario, is_superadmin: !!user.is_superadmin, id_geriatrico: active ? active.id_geriatrico : null },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTS, maxAge: 12 * 60 * 60 * 1000 });

    return res.json({
      token,
      user: { id_usuario: user.id_usuario, usuario: user.usuario, correo: user.correo, is_superadmin: !!user.is_superadmin },
      geriatrico_activo: active,
      geriatrico_list: geriatricoList
    });
  } catch (err) {
    return handlePgError(res, err, 'Error en el servidor');
  }
};

/* =========================
   PERFIL / QUIÉN SOY (SIN CAMBIOS)
========================== */
exports.me = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id_usuario, u.usuario, u.correo, u.is_superadmin, p.nombres, p.apellidos
         FROM usuario u
         JOIN persona p ON p.id_persona = u.id_persona
        WHERE u.id_usuario = $1
        LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const u = rows[0];
    const firstName = (u.nombres || '').trim().split(/\s+/)[0] || '';
    const firstLast = (u.apellidos || '').trim().split(/\s+/)[0] || '';
    const shortName = `${firstName} ${firstLast}`.trim();

    let roleLabel = '—';
    let geriatrico_list = [];

    if (u.is_superadmin) {
      roleLabel = 'Superusuario';
    } else {
      const gs = await pool.query(
        `SELECT g.id_geriatrico, g.nombre, gu.rol, gu.activo
           FROM geriatrico_usuario gu
           JOIN geriatrico g ON g.id_geriatrico = gu.id_geriatrico
          WHERE gu.id_usuario = $1
          ORDER BY g.nombre`,
        [u.id_usuario]
      );
      geriatrico_list = gs.rows;
      const any = geriatrico_list.find(x => x.activo) || geriatrico_list[0];
      if (any) {
        roleLabel = (any.rol || '').toString().toLowerCase();
        roleLabel = roleLabel === 'admin' ? 'Administrador'
               : roleLabel === 'cuidador' ? 'Cuidador'
               : any.rol;
      }
    }

    return res.json({
      user: {
        id_usuario: u.id_usuario, usuario: u.usuario, correo: u.correo,
        is_superadmin: !!u.is_superadmin, short_name: shortName,
        role_label: roleLabel, nombres: u.nombres, apellidos: u.apellidos
      },
      geriatrico_activo: req.user.id_geriatrico || null,
      geriatrico_list
    });
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener sesión');
  }
};

exports.perfilBasico = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM public.perfil_usuario($1)', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Perfil no encontrado' });
    return res.json({ data: rows });
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener el perfil');
  }
};

/* =========================
   LISTAR (filtra activos por defecto)
========================== */
exports.obtenerUsuarios = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    if (!idG) return res.status(400).json({ error: 'Selecciona un geriátrico' });

    const incluirSuper = req.query.incluir_super === '1' || req.query.incluir_super === 'true';
    const rolesTodos   = req.query.roles_todos   === '1' || req.query.roles_todos   === 'true';
    const soloActivos  = !(req.query.incluir_inactivos === '1' || req.query.incluir_inactivos === 'true');

    const { rows } = await pool.query(
      'SELECT * FROM public.listar_usuarios($1,$2,$3)',
      [idG, incluirSuper, !rolesTodos]
    );

    const lista = soloActivos ? rows.filter(r => r.estado !== false) : rows;
    return res.json(lista);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener los usuarios');
  }
};

/* =========================
   CREAR (sin tocar tu función)
   - Si hay duplicado y está INACTIVO => 409 con { reactivable:true, id_usuario }
========================== */
const validateIdentificacion = (tipo, identificacion) => {
  if (tipo === 'CEDULA') {
    if ((identificacion || '').length !== 10) return "La cédula debe tener 10 dígitos";
  } else if (tipo === 'RUC') {
    if ((identificacion || '').length !== 13) return "El RUC debe tener 13 dígitos";
  } else if (tipo === 'PASAPORTE') {
    const len = (identificacion || '').length;
    if (len < 6 || len > 20) return "El pasaporte debe tener entre 6 y 20 caracteres alfanuméricos";
  }
  return "";
};

exports.crearUsuario = async (req, res) => {
  const {
    nombres, apellidos, tipo_identificacion, identificacion,
    fecha_nacimiento, sexo, usuario, correo, contrasena,
    is_superadmin = false, rol = null, estado
  } = req.body;

  const identificacionError = validateIdentificacion(tipo_identificacion, identificacion);
  if (identificacionError) {
    return res.status(400).json({ error: identificacionError });
  }
  if (!usuario || !correo || !contrasena) {
    return res.status(400).json({ error: 'usuario, correo y contrasena son requeridos' });
  }

  let idG = null;
  if (!is_superadmin) {
    idG = req.geriatricoId;
    if (!idG) return res.status(400).json({ error: 'Selecciona un geriátrico antes de crear usuarios no superadmin' });
    if (!rol) return res.status(400).json({ error: 'Rol es requerido (admin | cuidador)' });
    const rolLower = String(rol).toLowerCase();
    if (!['admin','cuidador'].includes(rolLower)) {
      return res.status(400).json({ error: 'Rol inválido (use admin | cuidador)' });
    }
  }

  try {
    const { rows } = await pool.query(
      `SELECT public.crear_usuario_con_rol(
         $1,$2,$3,$4,$5,$6,
         $7,$8,$9,
         $10,
         $11,$12,
         $13
       ) AS id_usuario`,
      [
        nombres, apellidos, (tipo_identificacion || '').toUpperCase(), identificacion,
        fecha_nacimiento, sexo,
        usuario, correo, String(contrasena),
        !!is_superadmin,
        idG, is_superadmin ? null : String(rol).toLowerCase(),
        (typeof estado === 'boolean' ? estado : true)
      ]
    );

    return res.status(201).json({
      mensaje: 'Usuario creado con éxito',
      id_usuario: rows[0]?.id_usuario
    });
  } catch (err) {
    if (err?.code === '23505') {
      const q = await pool.query(
        `SELECT u.id_usuario, u.estado
           FROM usuario u
           JOIN persona p ON p.id_persona = u.id_persona
          WHERE LOWER(u.usuario) = LOWER($1)
             OR LOWER(u.correo)  = LOWER($2)
             OR (UPPER(p.tipo_identificacion) = UPPER($3) AND p.identificacion = $4)
          LIMIT 1`,
        [usuario, correo, tipo_identificacion, identificacion]
      );
      const dupe = q.rows[0];
      if (dupe && dupe.estado === false) {
        return res.status(409).json({
          error: 'El usuario ya existe pero está inactivo.',
          reactivable: true,
          id_usuario: dupe.id_usuario
        });
      }
      return res.status(409).json({ error: 'Ya existe un usuario con esos datos.' });
    }
    const mapped = mapPgError(err);
    return res.status(mapped.status).json(mapped.payload);
  }
};

/* =========================
   EDITAR (datos básicos + estado opcional)
========================== */
exports.editarUsuario = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const {
    nombres, apellidos, tipo_identificacion, identificacion,
    fecha_nacimiento, sexo, usuario, correo, estado
  } = req.body || {};

  if (!id) return res.status(400).json({ error: 'id inválido' });

  try {
    await pool.query(
      `UPDATE persona
          SET nombres = $1, apellidos = $2,
              tipo_identificacion = $3, identificacion = $4,
              fecha_nacimiento = $5, sexo = $6
        WHERE id_persona = (SELECT id_persona FROM usuario WHERE id_usuario = $7)`,
      [nombres, apellidos, (tipo_identificacion||'').toUpperCase(), identificacion, fecha_nacimiento, sexo, id]
    );

    await pool.query(
      `UPDATE usuario
          SET usuario = $1, correo = $2, estado = COALESCE($3, estado)
        WHERE id_usuario = $4`,
      [usuario, correo, estado, id]
    );

    res.json({ ok: true });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Usuario/correo/identificación ya en uso' });
    }
    return handlePgError(res, err, 'No se pudo actualizar el usuario');
  }
};

/* =========================
   DESACTIVAR (soft delete)
========================== */
exports.desactivarUsuario = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idG = req.geriatricoId;
  if (!id || !idG) return res.status(400).json({ error: 'Parámetros inválidos' });

  try {
    await pool.query('SELECT public.sp_soft_delete_usuario($1,$2)', [id, idG]);
    res.json({ ok: true });
  } catch (err) {
    return handlePgError(res, err, 'No se pudo desactivar el usuario');
  }
};

/* =========================
   REACTIVAR
========================== */
exports.reactivarUsuario = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idG = req.geriatricoId;
  const rol = (req.body?.rol || 'cuidador').toLowerCase();
  if (!id || !idG) return res.status(400).json({ error: 'Parámetros inválidos' });
  if (!['admin','cuidador'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido (admin | cuidador)' });
  }

  try {
    await pool.query('SELECT public.sp_reactivar_usuario($1,$2,$3)', [id, idG, rol]);
    res.json({ ok: true });
  } catch (err) {
    return handlePgError(res, err, 'No se pudo reactivar el usuario');
  }
};

/* =========================
   CAMBIAR PASSWORD (SIN CAMBIOS)
========================== */
exports.cambiarPassword = async (req, res) => {
  try {
    const cur =
      (req.body.currentPassword ?? req.body.passwordActual ?? req.body.contrasenaActual ?? "").toString();
    const next =
      (req.body.newPassword ?? req.body.nuevaContrasena ?? req.body.contrasenaNueva ?? "").toString();
    const confirm =
      (req.body.confirmPassword ?? req.body.confirmarContrasena ?? req.body.contrasenaConfirma ?? next).toString();

    if (!cur || !next) return res.status(400).json({ mensaje: "Contraseña actual y nueva son requeridas" });
    if (next !== confirm) return res.status(400).json({ mensaje: "La confirmación no coincide" });
    if (next.length < 8) return res.status(400).json({ mensaje: "La nueva contraseña debe tener al menos 8 caracteres" });

    const r = await pool.query(`SELECT contrasena FROM usuario WHERE id_usuario = $1 LIMIT 1`, [req.user.id]);
    if (!r.rows.length) return res.status(404).json({ mensaje: "Usuario no encontrado" });

    const stored = r.rows[0].contrasena || "";
    let ok = false;
    if (isBcrypt(stored)) ok = await bcrypt.compare(cur, stored);
    else ok = cur === stored;
    if (!ok) return res.status(401).json({ mensaje: "La contraseña actual no es correcta" });

    if (isBcrypt(stored)) {
      const same = await bcrypt.compare(next, stored);
      if (same) return res.status(400).json({ mensaje: "La nueva contraseña no puede ser igual a la actual" });
    } else if (next === stored) {
      return res.status(400).json({ mensaje: "La nueva contraseña no puede ser igual a la actual" });
    }

    const newHash = await bcrypt.hash(next, 10);
    await pool.query(
      `UPDATE usuario SET contrasena = $1, debe_cambiar_password = false WHERE id_usuario = $2`,
      [newHash, req.user.id]
    );

    return res.json({ ok: true, mensaje: "Contraseña actualizada" });
  } catch (err) {
    return handlePgError(res, err, "Error al cambiar la contraseña");
  }
};

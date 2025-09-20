const pool = require('../db');
const { sendMail } = require('../utils/email');
const { mapPgError } = require('../utils/pg-errors');
const { handlePgError } = require('../utils/handle-error');

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
const API_BASE = process.env.API_BASE || 'http://localhost:3001';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

const validarBody = (b = {}) => {
  const errors = {};
  if (!b.nombre_geriatrico || !b.nombre_geriatrico.trim()) errors.nombre_geriatrico = 'Requerido';
  if (!isEmail(b.email_solicitante)) errors.email_solicitante = 'Correo inválido';
  if (!b.ciudad || !b.ciudad.trim()) errors.ciudad = 'Requerido';
  if (!b.nombres_solicitante || !b.nombres_solicitante.trim()) errors.nombres_solicitante = 'Requerido';
  if (!b.apellidos_solicitante || !b.apellidos_solicitante.trim()) errors.apellidos_solicitante = 'Requerido';
  if (!/^\d{10,13}$/.test(String(b.identificacion || ''))) errors.identificacion = '10–13 dígitos';
  return errors;
};

const mapPgErrorToResponse = (err) => {
  const msg = (err?.message || '').toUpperCase();

  if (msg.includes('EMAIL_EN_USO')) {
    return { status: 409, payload: { error: 'El correo ya está en uso', fields: { email_solicitante: 'El correo ya está en uso' } } };
  }
  if (msg.includes('SOLICITUD_PENDIENTE')) {
    return { status: 409, payload: { error: 'Ya existe una solicitud pendiente con este correo', fields: { email_solicitante: 'Ya existe una solicitud pendiente con este correo' } } };
  }
  if (
    msg.includes('EMAIL_INVALIDO') ||
    msg.includes('NOMBRE_REQUERIDO') ||
    msg.includes('CIUDAD_REQUERIDA') ||
    msg.includes('NOMBRES_REQUERIDOS') ||
    msg.includes('APELLIDOS_REQUERIDOS') ||
    msg.includes('IDENTIFICACION_INVALIDA')
  ) {
    return { status: 400, payload: { error: 'Datos inválidos', detail: err.message } };
  }

  if (err.code === '23502' && /invitacion_usuario/i.test(err.table || '')) {
    return {
      status: 500,
      payload: {
        error:
          "Esquema desactualizado: 'invitacion_usuario.id_geriatrico' no puede ser NULL durante la solicitud. " +
          'Aplica la migración para permitir NULL y reintenta.',
      },
    };
  }

  if (err.code === '23505' && /token/i.test(err.constraint || '')) {
    return { status: 409, payload: { error: 'Token ya registrado. Intenta nuevamente.' } };
  }

  return null;
};

exports.crearSolicitud = async (req, res) => {
  try {
    const b = req.body || {};

    const fields = validarBody(b);
    if (Object.keys(fields).length) {
      return res.status(400).json({ error: 'Validación', fields });
    }

    const used = await pool.query(
      'SELECT 1 FROM public.usuario WHERE lower(correo) = lower($1) LIMIT 1',
      [b.email_solicitante]
    );
    if (used.rowCount) {
      return res.status(409).json({
        error: 'El correo ya está en uso',
        fields: { email_solicitante: 'El correo ya está en uso' },
      });
    }

    const pend = await pool.query(
      `SELECT 1
         FROM public.solicitud_geriatrico
        WHERE lower(email_solicitante) = lower($1)
          AND estado = 'pendiente'
        LIMIT 1`,
      [b.email_solicitante]
    );
    if (pend.rowCount) {
      return res.status(409).json({
        error: 'Ya existe una solicitud pendiente con este correo',
        fields: { email_solicitante: 'Ya existe una solicitud pendiente con este correo' },
      });
    }

    let spRows = [];
    try {
      const q = await pool.query(
        `SELECT * FROM public.crear_solicitud_geriatrico_full(
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
         )`,
        [
          b.nombre_geriatrico, b.ruc || null, b.email_solicitante, b.ciudad,
          b.telefono || null, b.direccion || null, b.nombres_solicitante,
          b.apellidos_solicitante, b.identificacion, b.fecha_nacimiento || null, b.sexo || null,
        ]
      );
      spRows = q.rows || [];
    } catch (e) {
      console.warn('SP crear_solicitud_geriatrico_full falló, intento fallback:', e.message);
    }

    let id_solicitud, token_aprobacion;

    if (spRows.length) {
      ({ id_solicitud, token_aprobacion } = spRows[0]);
    } else {
      const f = await pool.query(
        `SELECT id_solicitud, token_aprobacion
           FROM public.solicitud_geriatrico
          WHERE lower(email_solicitante) = lower($1)
          ORDER BY id_solicitud DESC
          LIMIT 1`,
        [b.email_solicitante]
      );
      if (!f.rowCount) {
        return res.status(500).json({ error: 'SP crear_solicitud_geriatrico_full no devolvió filas' });
      }
      ({ id_solicitud, token_aprobacion } = f.rows[0]);
    }

    const approveUrl = `${API_BASE}/api/solicitudes-geriatrico/confirmar?token=${encodeURIComponent(token_aprobacion)}`;
    const rejectUrl  = `${API_BASE}/api/solicitudes-geriatrico/rechazar?token=${encodeURIComponent(token_aprobacion)}`;

    const asunto = `Nueva solicitud de geriátrico: ${b.nombre_geriatrico}`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <p>Se registró una nueva solicitud de geriátrico.</p>
        <ul>
          <li><b>Nombre:</b> ${b.nombre_geriatrico}</li>
          <li><b>RUC:</b> ${b.ruc || '-'}</li>
          <li><b>Solicitante:</b> ${b.nombres_solicitante} ${b.apellidos_solicitante}</li>
          <li><b>Correo solicitante:</b> ${b.email_solicitante}</li>
          <li><b>Identificación:</b> ${b.identificacion}</li>
          <li><b>Ciudad:</b> ${b.ciudad}</li>
          <li><b>Teléfono:</b> ${b.telefono || '-'}</li>
          <li><b>Dirección:</b> ${b.direccion || '-'}</li>
        </ul>
        <p>Acciones:</p>
        <p>
          <a href="${approveUrl}" target="_blank"
             style="background:#16a34a;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Aceptar</a>
          &nbsp;&nbsp;
          <a href="${rejectUrl}" target="_blank"
             style="background:#ef4444;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Rechazar</a>
        </p>
      </div>
    `;
    try { await sendMail(SUPERADMIN_EMAIL, asunto, html); } catch (e) { console.warn('Email superadmin falló:', e.message); }

    return res.status(201).json({
      message: 'Solicitud enviada. Revisa tu correo con el resultado.',
      id_solicitud,
    });
  } catch (err) {
    const mapped = mapPgErrorToResponse(err);
    if (mapped) return res.status(mapped.status).json(mapped.payload);
    // fallback mapeo genérico
    const gen = mapPgError(err);
    return res.status(gen.status).json({ error: gen.error });
  }
};

exports.confirmarPorToken = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Falta token' });

  try {
    const { rows } = await pool.query('SELECT * FROM public.aprobar_solicitud_por_token($1)', [token]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Token inválido o ya usado' });

    const r = rows[0];

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <p>Tu solicitud ha sido <b>aprobada</b>.</p>
        <p>Credenciales de <b>Administrador</b>:</p>
        <ul>
          <li><b>Usuario:</b> ${r.usuario}</li>
          <li><b>Contraseña temporal:</b> ${r.temp_password}</li>
        </ul>
        <p>Por seguridad, deberás cambiar la contraseña al iniciar sesión por primera vez.</p>
      </div>
    `;
    try { await sendMail(r.email_solicitante, 'Geriátrico aprobado - Credenciales de administrador', html); } catch (e) {}

    return res.status(200).json({
      message: 'Geriátrico aprobado',
      id_geriatrico: r.id_geriatrico,
      id_usuario: r.id_usuario,
      usuario: r.usuario,
    });
  } catch (err) {
    return handlePgError(res, err, 'No se pudo aprobar la solicitud');
  }
};

exports.rechazarPorToken = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Falta token' });

  try {
    const { rows } = await pool.query('SELECT * FROM public.rechazar_solicitud_por_token($1)', [token]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Token inválido o ya usado' });

    const r = rows[0];

    if (r.email_solicitante) {
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
          <p>Tu solicitud fue <b>rechazada</b>.</p>
          <p>Si crees que se trata de un error, por favor responde a este correo.</p>
        </div>
      `;
      try { await sendMail(r.email_solicitante, 'Solicitud rechazada', html); } catch (e) {}
    }

    return res.status(200).json({ message: 'Solicitud rechazada' });
  } catch (err) {
    return handlePgError(res, err, 'No se pudo rechazar la solicitud');
  }
};

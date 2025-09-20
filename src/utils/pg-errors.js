// src/utils/pg-errors.js
function mapPgError(err) {
  let status = 500;
  let payload = { error: 'Error en el servidor' };
  if (!err) return { status, payload };

  // --- UNIQUE VIOLATION ---
  if (err.code === '23505') {
    status = 409;
    const c = String(err.constraint || '').toLowerCase();

    if (c.includes('geriatrico_nombre_key')) {
      return { status, payload: { error: 'El nombre del geriátrico ya está registrado', fields: { nombre_geriatrico: 'Este nombre ya está en uso' } } };
    }
    if (c.includes('geriatrico_ruc_key')) {
      return { status, payload: { error: 'El RUC del geriátrico ya está registrado', fields: { ruc: 'Este RUC ya está en uso' } } };
    }
    if (c.includes('geriatrico_usuario_id_geriatrico_id_usuario_key')) {
      return { status, payload: { error: 'El usuario ya está asociado a este geriátrico', fields: { usuario: 'Este usuario ya está asociado a un geriátrico' } } };
    }
    if (c.includes('ux_geriatrico_usuario')) {
      return { status, payload: { error: 'El usuario ya está vinculado a este geriátrico', fields: { usuario: 'Este usuario ya está vinculado' } } };
    }
    if (c.includes('invitation_usuario_token_key')) {
      return { status, payload: { error: 'El token de invitación ya existe', fields: { token: 'Este token ya está registrado' } } };
    }
    if (c.includes('persona_identificacion_key')) {
      return { status, payload: { error: 'La identificación de la persona ya está registrada', fields: { identificacion: 'Este número de identificación ya está registrado' } } };
    }
    if (c.includes('progreso_test_nivel_id_progreso_id_seccion_key')) {
      return { status, payload: { error: 'El progreso del test en esta sección ya está registrado', fields: { progreso_test: 'Este progreso ya está en esta sección' } } };
    }
    if (c.includes('sesion_test_item_id_session_id_ejercicio_key')) {
      return { status, payload: { error: 'El item de sesión con este ejercicio ya existe', fields: { ejercicio: 'Este ejercicio ya está asignado' } } };
    }
    if (c.includes('uq_test_seccion')) {
      return { status, payload: { error: 'Ya existe una sección para este test', fields: { test_seccion: 'Ya existe esta sección para este test' } } };
    }
    if (c.includes('usuario_correo_key')) {
      return { status, payload: { error: 'El correo del usuario ya está registrado', fields: { correo: 'Este correo ya está en uso' } } };
    }
    if (c.includes('usuario_usuario_key')) {
      return { status, payload: { error: 'El nombre de usuario ya está registrado', fields: { usuario: 'Este nombre de usuario ya está en uso' } } };
    }

    // NUEVO: único por correo solo si la solicitud está pendiente
    if (c.includes('ux_solicitud_email_pendiente')) {
      return { status, payload: { error: 'Ya existe una solicitud pendiente con este correo', fields: { email_solicitante: 'Ya existe una solicitud pendiente con este correo' } } };
    }

    // Genérico por si el detalle trae los campos
    const detail = String(err.detail || '').toLowerCase();
    const m = detail.match(/key \(([^)]+)\)=\([^)]+\) already exists/);
    if (m && m[1]) {
      const keys = m[1].split(',').map(s => s.trim());
      const fields = {};
      keys.forEach(k => { fields[k] = 'Ya registrado'; });
      return { status, payload: { error: 'Registro duplicado', fields } };
    }

    return { status, payload: { error: 'Registro duplicado' } };
  }

  // --- CHECK VIOLATION ---
  if (err.code === '23514') {
    status = 400;
    const c = String(err.constraint || '').toLowerCase();

    if (c.includes('ck_solicitud_email_formato')) {
      return { status, payload: { error: 'Correo inválido', fields: { email_solicitante: 'Formato de correo inválido' } } };
    }
    if (c.includes('ck_solicitud_tipo_identificacion')) {
      return { status, payload: { error: 'Tipo de identificación inválido', fields: { tipo_identificacion: 'Debe ser CEDULA, RUC o PASAPORTE' } } };
    }
    if (c.includes('ck_solicitud_identificacion_por_tipo')) {
      return { status, payload: { error: 'Identificación inválida para el tipo seleccionado', fields: { identificacion: 'No cumple con el formato requerido' } } };
    }
    if (c.includes('ck_solicitud_ruc_len')) {
      return { status, payload: { error: 'RUC inválido', fields: { ruc: 'El RUC debe tener 13 dígitos' } } };
    }
    if (c.includes('ck_solicitud_direccion_len')) {
      return { status, payload: { error: 'Dirección demasiado larga', fields: { direccion: 'Máximo 255 caracteres' } } };
    }
    if (c.includes('ck_solicitud_estado')) {
      return { status, payload: { error: 'Estado inválido', fields: { estado: 'Debe ser pendiente, aprobado o rechazado' } } };
    }

    return { status, payload: { error: 'Datos inválidos' } };
  }

  // --- STRING DATA RIGHT TRUNCATION (varchar(n) excedido) ---
  if (err.code === '22001') {
    status = 400;
    // El mensaje suele incluir el nombre de la columna
    const msg = String(err.message || '');
    // heurística simple
    const posibles = ['nombre_geriatrico','ruc','email_solicitante','estado','token_aprobacion','telefono','ciudad','nombres_solicitante','apellidos_solicitante','tipo_identificacion','identificacion','sexo'];
    const hit = posibles.find(col => msg.toLowerCase().includes(col));
    const fields = {};
    if (hit) fields[hit] = 'Longitud excedida para este campo';
    return { status, payload: { error: 'Longitud de texto excedida', fields: Object.keys(fields).length ? fields : undefined } };
  }

  return { status, payload };
}

module.exports = { mapPgError };

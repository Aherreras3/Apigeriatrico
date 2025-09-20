// src/utils/handle-error.js
function handlePgError(res, err, fallbackMsg = 'Error en el servidor') {
  // NO importes mapPgError aquí para evitar dobles declaraciones / ciclos.
  console.error(fallbackMsg, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    table: err?.table,
    schema: err?.schema,
    where: err?.where,
  });
  return res.status(500).json({ error: fallbackMsg });
}

module.exports = { handlePgError };

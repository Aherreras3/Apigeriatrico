// controllers/dashboard-controller.js
const pool = require('../db');
const { handlePgError } = require('../utils/handle-error');

// controllers/dashboard-controller.js
// controllers/dashboard-controller.js
exports.dashboardMetrics = async (req, res) => {
  try {
    const idG = req.geriatricoId;
    if (!idG) return res.status(400).json({ error: 'Selecciona un geriátrico' });

    const { rows } = await pool.query('SELECT public.dashboard_metrics($1) AS m', [idG]);
    const m = rows[0]?.m || {};
    res.json({
      top_secciones:               m.top_secciones || [],
      adultos_evaluados:           m.adultos_evaluados || 0,
      tests_realizados_intentos:   m.tests_realizados_intentos || 0,
      tests_pendientes_intentos:   m.tests_pendientes_intentos || 0,   // <<<
      tests_realizados_tests:      m.tests_realizados_tests || 0,
      tests_creados_total:         m.tests_creados_total || 0,
      tests_no_evaluados_tests:    m.tests_no_evaluados_tests || 0,    // por TEST
      cuidadores_registrados:      m.cuidadores_registrados || 0,
      adultos_mayores:             m.adultos_mayores || 0,
    });
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener métricas del dashboard');
  }
};

// routes/reportes-routes.js
const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/auth-middleware');
const requireGeriatrico = require('../middlewares/tenant');
const R = require('../controllers/reportes-controller');

// Montaje sugerido en app.js: app.use('/movil/admin/reportes', router);

router.get('/ejecucion-tests-con-promedio',
  verificarToken, requireGeriatrico, R.ejecucionTestsConPromedio);

// routes/reportes-routes.js
router.get('/participacion-adulto',
  verificarToken, requireGeriatrico, R.participacionPorAdulto);

router.get('/desempeno-seccion-nivel',
  verificarToken, requireGeriatrico, R.desempenoSeccionNivel);
module.exports = router;

router.get('/secciones-uso',
  verificarToken, requireGeriatrico, R.seccionesUso);

router.get('/cuidadores',
  verificarToken, requireGeriatrico, R.cuidadores);

// routes/reportes-routes.js
router.get('/progreso-tiempo',
  verificarToken, requireGeriatrico, R.progresoTiempo);

router.get('/abandono',
  verificarToken, requireGeriatrico, R.abandono);

router.get('/frecuencia-uso',
  verificarToken, requireGeriatrico, R.frecuenciaUso);

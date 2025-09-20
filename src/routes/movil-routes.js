// routes/movil-routes.js
const express = require('express');
const router = express.Router();

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const verificarToken = require('../middlewares/auth-middleware');
const requireGeriatrico = require('../middlewares/tenant');

const {
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

  // Intentos
  crearIntentoMovil,
  registrarRespuestaIntentoMovil,
  cerrarIntentoMovil,
  progresoParticipanteDetalleMovil,

  // Legacy
  responderEjercicioMovil,

  // Tienda + XP
  tiendaItems,
  tiendaRedimir,
  tiendaHistorial,
  rankingXp,
  xpSaldoAdulto,

  // Tienda Admin
  tiendaAdminList,
  tiendaAdminCreate,
  tiendaAdminUpdate,
  tiendaAdminDelete,
  tiendaIcon,

  // Logros
  logrosAdultoMovil,
  logroIcon,
} = require('../controllers/movil-controller');

/** Montar en app.js:
 *   app.use('/movil', router);
 */

// ---------- Adultos ----------
router.get('/adultos', verificarToken, requireGeriatrico, obtenerAdultosPorGeriatrico);
router.get('/adultos/contar', verificarToken, requireGeriatrico, contarAdultosPorGeriatrico);
router.get('/adultos/:idAdulto', verificarToken, requireGeriatrico, detalleAdultoMovil);
router.get('/adultos/:idAdulto/nivel', verificarToken, requireGeriatrico, nivelActualAdulto);
router.get('/adultos/:idAdulto/resumen', verificarToken, requireGeriatrico, resumenAdultoMovil);
router.get('/adultos/:idAdulto/actividad', verificarToken, requireGeriatrico, actividadRecienteMovil);
router.get('/adultos/:idAdulto/logros', verificarToken, requireGeriatrico, logrosAdultoMovil);

// ---------- Progreso ----------
router.get('/progreso/resumen', verificarToken, requireGeriatrico, resumenProgreso);
router.get('/progreso/adulto/:idAdulto', verificarToken, requireGeriatrico, progresoPorAdulto);

// ---------- Tests ----------
router.get('/tests-disponibles', verificarToken, requireGeriatrico, testsDisponiblesMovil);
router.get('/ejercicios/personas', verificarToken, requireGeriatrico, personasConTestMovil);
router.get('/test/:idTest/ejercicios', verificarToken, requireGeriatrico, ejerciciosPorTestMovil);
router.get('/test/:idTest/estado/:idAdulto', verificarToken, requireGeriatrico, estadoTestMovil);

// ---------- Intentos ----------
router.post('/test/:idTest/attempts', verificarToken, requireGeriatrico, crearIntentoMovil);
router.post('/attempt/:idProgreso/answers', verificarToken, requireGeriatrico, registrarRespuestaIntentoMovil);
router.post('/attempt/:idProgreso/close', verificarToken, requireGeriatrico, cerrarIntentoMovil);
router.get('/test/:idTest/progreso/:idAdulto', verificarToken, requireGeriatrico, progresoParticipanteDetalleMovil);

// ---------- Legacy ----------
router.post('/ejercicio/:idEjercicio/responder', verificarToken, requireGeriatrico, responderEjercicioMovil);

// ---------- Tienda (protegido) ----------
router.get('/tienda/items', verificarToken, requireGeriatrico, tiendaItems); // ← LISTA (FALTABA)
router.post('/tienda/redimir', verificarToken, requireGeriatrico, tiendaRedimir);
router.get('/tienda/:idAdulto/historial', verificarToken, requireGeriatrico, tiendaHistorial);

// Saldos / Ranking
router.get('/xp/saldo/:idAdulto', verificarToken, requireGeriatrico, xpSaldoAdulto);
router.get('/xp/ranking', verificarToken, requireGeriatrico, rankingXp);

// ---------- Admin tienda ----------
router.get('/admin/tienda/items', verificarToken, requireGeriatrico, tiendaAdminList);
router.post('/admin/tienda/items', verificarToken, requireGeriatrico, upload.single('icono_file'), tiendaAdminCreate);
router.put('/admin/tienda/items/:id', verificarToken, requireGeriatrico, upload.single('icono_file'), tiendaAdminUpdate);
router.delete('/admin/tienda/items/:id', verificarToken, requireGeriatrico, tiendaAdminDelete);

// Iconos
router.get('/tienda/items/:id/icon', tiendaIcon);   // icono de ítems
router.get('/logros/:id/icon', logroIcon);          // icono de logros

module.exports = router;

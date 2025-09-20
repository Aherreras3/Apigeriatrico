// src/routes/test-routes.js
const express = require('express');
const router = express.Router();

const verificarToken   = require('../middlewares/auth-middleware');
const requireGeriatrico = require('../middlewares/tenant');

const {
  obtenerTests,
  crearTest,
  obtenerTestPorId,
  agregarParticipante,
  listarParticipantesTest,
  marcarParticipanteCompletado,
  eliminarParticipante,
  obtenerProgresoParticipante,
  vincularSeccionATest,
  listarSeccionesDeTest,
  
  eliminarTest,
} = require('../controllers/test-controller');

router.get('/', verificarToken, requireGeriatrico, obtenerTests);
router.post('/', verificarToken, requireGeriatrico, crearTest);
router.get('/:idTest/detalle', verificarToken, requireGeriatrico, obtenerTestPorId);

router.post('/:id/participantes', verificarToken, requireGeriatrico, agregarParticipante);
router.get('/:idTest/participantes', verificarToken, requireGeriatrico, listarParticipantesTest);
router.patch('/:idTest/participantes/:idAdulto/completar', verificarToken, requireGeriatrico, marcarParticipanteCompletado);
router.delete('/:idTest/participantes/:idAdulto', verificarToken, requireGeriatrico, eliminarParticipante);

router.get('/:idTest/progreso/:idAdulto', verificarToken, requireGeriatrico, obtenerProgresoParticipante);

router.post('/:id/secciones', verificarToken, requireGeriatrico, vincularSeccionATest);
router.get('/:id/secciones',  verificarToken, requireGeriatrico, listarSeccionesDeTest);
router.delete('/:idTest', verificarToken, requireGeriatrico, eliminarTest);  



module.exports = router;

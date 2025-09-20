const express = require('express');
const router = express.Router();
const verificarToken = require('../middlewares/auth-middleware');
const requireGeriatrico = require('../middlewares/tenant');
const {
  obtenerNiveles,
  obtenerNivelesPorSeccion,
  crearNivel,
  eliminarNivel,
} = require('../controllers/nivel-controller');

router.get('/', verificarToken, requireGeriatrico, obtenerNiveles);
router.get('/seccion/:idSeccion', verificarToken, requireGeriatrico, obtenerNivelesPorSeccion);
router.post('/', verificarToken, requireGeriatrico, crearNivel);
router.delete('/:idNivel', verificarToken, requireGeriatrico, eliminarNivel);

module.exports = router;

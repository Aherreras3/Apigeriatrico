const express = require('express');
const router = express.Router();
const verificarToken = require('../middlewares/auth-middleware');
const requireGeriatrico = require('../middlewares/tenant');

const {
  crearAdultoMayor,
  obtenerAdultosMayores,
  obtenerAdultoMayorPorId, // NUEVO
  actualizarAdultoMayor,   // NUEVO
  eliminarAdultoMayor,     // NUEVO
} = require('../controllers/adulto-mayor-controller');

router.post('/',  verificarToken, requireGeriatrico, crearAdultoMayor);
router.get('/',   verificarToken, requireGeriatrico, obtenerAdultosMayores);

router.get('/:id',    verificarToken, requireGeriatrico, obtenerAdultoMayorPorId); // NUEVO
router.put('/:id',    verificarToken, requireGeriatrico, actualizarAdultoMayor);   // NUEVO
router.delete('/:id', verificarToken, requireGeriatrico, eliminarAdultoMayor);     // NUEVO

module.exports = router;

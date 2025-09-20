const express = require('express');
const router = express.Router();
const verificarToken = require('../middlewares/auth-middleware');
const requireGeriatrico = require('../middlewares/tenant');
const seccionController = require('../controllers/seccion-controller');

router.get('/',  verificarToken, requireGeriatrico, seccionController.obtenerSecciones);
router.post('/', verificarToken, requireGeriatrico, seccionController.crearSeccion);
router.delete('/:id', verificarToken, requireGeriatrico, seccionController.eliminarSeccion);

module.exports = router;

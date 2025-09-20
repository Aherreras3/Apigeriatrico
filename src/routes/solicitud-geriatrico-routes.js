const { Router } = require('express');
const ctrl = require('../controllers/solicitud-geriatrico-controller');

const router = Router();

// Pública: crear solicitud de geriátrico
router.post('/', ctrl.crearSolicitud);

// Pública: confirmar/aprobar por token
router.get('/confirmar', ctrl.confirmarPorToken);

module.exports = router;

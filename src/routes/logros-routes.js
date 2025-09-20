const express = require('express');
const router = express.Router();

const verificarToken    = require('../middlewares/auth-middleware');
const requireGeriatrico = require('../middlewares/tenant');
const ctrl = require('../controllers/logros-controller');

// Icono (solo sesión; no exige admin)
router.get('/movil/logros/:id/icon', verificarToken, ctrl.icon);

// CRUD admin (admin/superadmin se valida DENTRO del controller)
router.get   ('/movil/admin/logros',            verificarToken, requireGeriatrico, ctrl.list);
router.get   ('/movil/admin/logros/:id',        verificarToken, requireGeriatrico, ctrl.getOne);
router.post  ('/movil/admin/logros',            verificarToken, requireGeriatrico, ctrl.uploadIcon, ctrl.create);
router.put   ('/movil/admin/logros/:id',        verificarToken, requireGeriatrico, ctrl.uploadIcon, ctrl.update);
router.delete('/movil/admin/logros/:id',        verificarToken, requireGeriatrico, ctrl.softDelete);
router.patch ('/movil/admin/logros/:id/activar',verificarToken, requireGeriatrico, ctrl.activate);

module.exports = router;

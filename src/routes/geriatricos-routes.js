const router = require('express').Router();
const verificarToken = require('../middlewares/auth-middleware');
const ctrl = require('../controllers/geriatricos-controller');

router.get('/', verificarToken, ctrl.listar);

module.exports = router;

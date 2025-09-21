// routes/user-routes.js
const express = require('express');
const router = express.Router();

const requireGeriatrico = require('../middlewares/tenant');
const verificarToken = require('../middlewares/auth-middleware');
const { COOKIE_NAME, COOKIE_OPTS } = require('../config/cookies');

const {
  loginUser,
  obtenerUsuarios,
  crearUsuario,
  me,
  perfilBasico,
  cambiarPassword,
  editarUsuario,
  desactivarUsuario,
  reactivarUsuario,
} = require('../controllers/user-controller');

/* -------- Auth -------- */
router.post('/login', loginUser);

router.post('/logout', (_req, res) => {
  // Importante: usar mismas opciones que al setear
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTS });
  res.json({ ok: true });
});

router.get('/whoami', verificarToken, (req, res) => {
  res.json(req.user);
});

router.post('/cambiar-password', verificarToken, cambiarPassword);

router.get('/me', verificarToken, me);
router.get('/perfil', verificarToken, perfilBasico);

/* -------- Usuarios -------- */
router.get('/', verificarToken, requireGeriatrico, obtenerUsuarios);
router.post('/crear', verificarToken, requireGeriatrico, crearUsuario);
router.put('/:id', verificarToken, requireGeriatrico, editarUsuario);

/* Soft delete + Reactivar */
router.delete('/:id', verificarToken, requireGeriatrico, desactivarUsuario);
router.patch('/:id/reactivar', verificarToken, requireGeriatrico, reactivarUsuario);

/* Ruta protegida de ejemplo */
router.get('/protegido', verificarToken, (req, res) => {
  res.json({ mensaje: 'Acceso permitido a la ruta protegida', usuario: req.user });
});

module.exports = router;

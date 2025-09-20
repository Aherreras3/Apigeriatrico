// routes/ejercicio-routes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middlewares/auth-middleware');
const requireGeriatrico = require('../middlewares/tenant');

const {
  crearEjercicio,
  obtenerEjerciciosPorSeccionYNivel,
  obtenerEjerciciosResumen,
  obtenerEjercicioDetalle,
  actualizarEjercicio,
  generarEjercicios,
  actualizarImagenEjercicio,
  obtenerImagenEjercicio,      // RAW
  obtenerImagenEjercicioHTML,  // HTML
  eliminarEjercicio,
} = require('../controllers/ejercicio-controller');

// Crear
router.post('/', verificarToken, requireGeriatrico, crearEjercicio);

// Listar por sección/nivel
router.get('/seccion/:idSeccion/nivel/:idNivel', verificarToken, requireGeriatrico, obtenerEjerciciosPorSeccionYNivel);
router.get('/seccion/:idSeccion/nivel/:idNivel/resumen', verificarToken, requireGeriatrico, obtenerEjerciciosResumen);

// Detalle / Editar / Eliminar
router.get('/:id', verificarToken, requireGeriatrico, obtenerEjercicioDetalle);
router.put('/:id', verificarToken, requireGeriatrico, actualizarEjercicio);
router.delete('/:id', verificarToken, requireGeriatrico, eliminarEjercicio);

// Imagen
router.put('/:id/imagen', verificarToken, requireGeriatrico, actualizarImagenEjercicio);
router.get('/:id/imagen/html', verificarToken, requireGeriatrico, obtenerImagenEjercicioHTML); // usar este en Front
router.get('/:id/imagen/raw',  verificarToken, requireGeriatrico, obtenerImagenEjercicio);     // opcional

// Generar con IA
router.post('/generar', verificarToken, requireGeriatrico, generarEjercicios);

module.exports = router;

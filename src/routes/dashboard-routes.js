// routes/dashboard-routes.js
const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/auth-middleware');
const requireGeriatrico = require('../middlewares/tenant');

const { dashboardMetrics } = require('../controllers/dashboard-controller');

// GET /dashboard/metrics
router.get('/metrics', verificarToken, requireGeriatrico, dashboardMetrics);

module.exports = router;

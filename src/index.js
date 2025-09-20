// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Confiar en proxy (Render/Reverse proxies)
app.set('trust proxy', 1);

// ===== CORS (múltiples orígenes con credenciales) =====
const rawOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Permite dominios *.onrender.com de forma opcional
const allowRenderWildcard = process.env.ALLOW_RENDER_WILDCARD === '1';

const corsOptions = {
  credentials: true,
  origin: function (origin, cb) {
    // peticiones sin origin (curl/health) -> permitir
    if (!origin) return cb(null, true);
    // Lista blanca exacta
    if (rawOrigins.includes(origin)) return cb(null, true);
    // Wildcard *.onrender.com (útil para PR previews)
    if (allowRenderWildcard && /\.onrender\.com$/.test(new URL(origin).hostname)) {
      return cb(null, true);
    }
    return cb(new Error(`CORS bloqueado para origin ${origin}`));
  },
};

app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// ===== Rutas =====
app.use('/api', require('./routes/authRoutes'));
app.use('/api/usuarios', require('./routes/user-routes'));
app.use('/api/adultos', require('./routes/adulto-mayor'));
app.use('/api/ejercicio', require('./routes/ejercicio-routes'));
app.use('/api/secciones', require('./routes/seccion-routes'));
app.use('/api/niveles', require('./routes/nivel-routes'));
app.use('/api/tests', require('./routes/test-routes'));
app.use('/api/solicitudes-geriatrico', require('./routes/solicitud-geriatrico-routes'));
app.use('/api/sesion', require('./routes/sesion-routes'));
app.use('/api/utils', require('./routes/utils-routes'));
app.use('/api/movil', require('./routes/movil-routes'));
app.use('/api/dashboard', require('./routes/dashboard-routes'));
app.use('/api/reportes', require('./routes/reportes-routes'));
app.use('/api/geriatricos', require('./routes/geriatricos-routes'));
app.use('/api', require('./routes/logros-routes'));

// Healthchecks
app.get('/healthz', (_req, res) => res.send('ok'));
app.get('/health', (_req, res) => res.json({ ok: true }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err?.message || err);
  res.status(500).json({ error: 'Error interno' });
});

// Importante: escuchar en 0.0.0.0 (no localhost) y PORT de env
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API corriendo en http://0.0.0.0:${PORT}`);
});

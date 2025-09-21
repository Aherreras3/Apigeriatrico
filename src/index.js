// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Confía en el proxy (Render/NGINX) para que secure:true funcione
app.set('trust proxy', 1);

// ----- CORS (whitelist desde .env) -----
const whitelist = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // Permite herramientas sin Origin (curl/postman) y SSR interno
    if (!origin) return cb(null, true);
    if (whitelist.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS not allowed for origin: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use((req, res, next) => {
  res.header('Vary', 'Origin'); // buena práctica para caches
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// Preflight antes de rutas
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// ----- Rutas -----
app.use('/api', require('./routes/authRoutes')); // si aquí tienes /usuarios/login está ok
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

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Error handler (con CORS en errores)
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err?.message || err);
  const origin = req.headers.origin;
  if (origin && whitelist.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.status(500).json({ error: 'Error interno' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

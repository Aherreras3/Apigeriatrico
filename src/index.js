const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Confianza en proxy (útil si usas algún reverse proxy)
app.set('trust proxy', 1);

// Middlewares
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// Rutas
app.use('/api', require('./routes/authRoutes'));                  // <-- logout primero o donde prefieras
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


// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/geriatricos', require('./routes/geriatricos-routes')); 

app.use('/api', require('./routes/logros-routes'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno' });
});





app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

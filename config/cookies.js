// config/cookies.js
const isProd = process.env.NODE_ENV === 'production';

exports.COOKIE_NAME = 'token';
exports.COOKIE_OPTS = {
  httpOnly: true,
  path: '/',
  sameSite: isProd ? 'none' : 'lax', // en prod permite cross-site
  secure: isProd,                    // en prod exige HTTPS
  maxAge: 12 * 60 * 60 * 1000,       // 12 horas
};

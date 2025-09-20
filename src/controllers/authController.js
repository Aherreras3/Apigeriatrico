const COOKIE_NAME = 'token';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax', // en prod (HTTPS + dominios distintos) => 'none'
  secure: false,   // en prod (HTTPS) => true
  path: '/',
};

const logout = (req, res) => {
  try {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
    return res.status(200).json({ message: 'Sesión cerrada correctamente' });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return res.status(500).json({ error: 'Error al cerrar sesión' });
  }
};

module.exports = { logout, COOKIE_NAME, COOKIE_OPTS };

const { Router } = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const verificarToken = require('../middlewares/auth-middleware');

const router = Router();

router.post('/usar-geriatrico', verificarToken, async (req, res) => {
  const { id_geriatrico } = req.body;
  if (!id_geriatrico) return res.status(400).json({ error: 'Falta id_geriatrico' });

  const ok = await pool.query(
    `SELECT 1 FROM geriatrico_usuario WHERE id_usuario=$1 AND id_geriatrico=$2 AND activo=TRUE`,
    [req.user.id, id_geriatrico]
  );
  if (!ok.rowCount) return res.status(403).json({ error: 'No pertenece a ese geriátrico' });

  const token = jwt.sign(
    { id: req.user.id, id_geriatrico, rol: req.user.rol },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 12 * 60 * 60 * 1000 });
  res.json({ token, id_geriatrico });
});

module.exports = router;

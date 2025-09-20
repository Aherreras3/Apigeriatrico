const { Router } = require('express');
const { sendMail } = require('../utils/email');

const router = Router();

router.get('/test-mail', async (req, res) => {
  try {
    await sendMail(
      process.env.SUPERADMIN_EMAIL,
      'Prueba SMTP ✔',
      '<p>Hola, este es un correo de prueba del API.</p>'
    );
    res.json({ ok: true, msg: 'Correo enviado (revisa bandeja).' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;

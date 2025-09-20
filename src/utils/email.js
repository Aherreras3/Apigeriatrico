const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

exports.sendMail = async (to, subject, html) => {
  const from = process.env.MAIL_FROM || `"Geriátrico" <${process.env.MAIL_USER}>`;
  const info = await transporter.sendMail({ from, to, subject, html });
  return info;
};

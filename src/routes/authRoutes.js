// routes/authRoutes.js
const express = require("express");
const { logout } = require("../controllers/authController");

const router = express.Router();

router.post("/logout", logout);

module.exports = router;

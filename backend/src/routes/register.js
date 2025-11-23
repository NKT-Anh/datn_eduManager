// routes/register.js
const express = require('express');
const router = express.Router();
const { register } = require('../controllers/registerController');

// Chỉ cần '/'
router.post('/', register);

module.exports = router;

const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyFirebaseToken');
const checkRole = require('../middlewares/checkRole');

// Route chỉ cho admin
router.get('/admin/dashboard', verifyToken, checkRole('admin'), (req, res) => {
  res.json({ message: `Xin chào admin ${req.currentUser.email}` });
});

// Route chỉ cho giáo viên
router.get('/teacher/dashboard', verifyToken, checkRole('teacher'), (req, res) => {
  res.json({ message: `Xin chào thầy/cô ${req.currentUser.name}` });
});

// routes/user/profileRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const {getProfile, updateProfile, changePassword } = require('../../controllers/user/profileController');
const profileController = require('../../controllers/user/profileController');

// 🧠 Lấy thông tin cá nhân
router.get('/', authMiddleware, profileController.getProfile);

// ✏️ Cập nhật thông tin cá nhân
router.put('/', authMiddleware, profileController.updateProfile);

// 🔑 Đổi mật khẩu
router.post('/change-password', authMiddleware, profileController.changePassword);

module.exports = router;

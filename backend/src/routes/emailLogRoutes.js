/**
 * Email Log Routes
 * Quản lý lịch sử và thống kê email
 */

const express = require('express');
const router = express.Router();
const emailLogController = require('../controllers/emailLogController');
const authMiddleware = require('../middlewares/authMiddleware');

// ✅ Lấy danh sách email logs (Admin xem chi tiết, BGH xem thống kê)
router.get('/', authMiddleware, emailLogController.getEmailLogs);

// ✅ Lấy thống kê email (Admin và BGH)
router.get('/stats', authMiddleware, emailLogController.getEmailStats);

// ✅ Xem chi tiết 1 email log (chỉ Admin)
router.get('/:id', authMiddleware, emailLogController.getEmailLogById);

module.exports = router;


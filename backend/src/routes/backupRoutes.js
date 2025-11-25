const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const authMiddleware = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/checkPermission');
const { PERMISSIONS } = require('../config/permissions');

// ✅ Tất cả routes đều yêu cầu Admin
router.use(authMiddleware);
router.use(checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }));

// Tạo backup mới
router.post('/', backupController.createBackup);

// Lấy danh sách backup
router.get('/', backupController.getBackups);

// Lấy thống kê backup
router.get('/stats', backupController.getBackupStats);

// Download backup
router.get('/:id/download', backupController.downloadBackup);

// Restore backup
router.post('/:id/restore', backupController.restoreBackup);

// Xóa backup
router.delete('/:id', backupController.deleteBackup);

module.exports = router;


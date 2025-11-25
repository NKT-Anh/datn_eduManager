const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const authMiddleware = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/checkPermission');
const { PERMISSIONS } = require('../config/permissions');

// Tất cả routes đều yêu cầu đăng nhập và quyền admin
router.use(authMiddleware);
router.use(checkPermission(PERMISSIONS.ADMIN_VIEW));

// GET /audit-logs - Lấy danh sách audit logs
router.get('/', auditLogController.getAuditLogs);

// GET /audit-logs/stats - Lấy thống kê audit logs
router.get('/stats', auditLogController.getAuditLogStats);

// GET /audit-logs/:id - Lấy chi tiết một audit log
router.get('/:id', auditLogController.getAuditLogById);

// DELETE /audit-logs - Xóa logs cũ (chỉ admin)
router.delete('/', checkPermission(PERMISSIONS.ADMIN_DELETE), auditLogController.deleteOldLogs);

module.exports = router;


const express = require('express');
const router  = express.Router();
const settingController = require("../controllers/settingController")
const authMiddleware = require('../middlewares/authMiddleware')
const checkPermission = require('../middlewares/checkPermission');
const { PERMISSIONS } = require('../config/permissions');

// ✅ Public route - Lấy thông tin công khai của trường (không cần auth)
router.get('/public', settingController.getPublicSchoolInfo);

// Settings chỉ Admin mới được quản lý
router.get('/', authMiddleware, checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }), settingController.getSettings);
router.put('/', authMiddleware, checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }), settingController.updateSettings);
router.post('/reset', authMiddleware, checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }), settingController.resetSettings);
router.post('/test-email', authMiddleware, checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }), settingController.testEmail)
router.post('/send-test-email', authMiddleware, checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }), settingController.seenEmail);

module.exports = router;
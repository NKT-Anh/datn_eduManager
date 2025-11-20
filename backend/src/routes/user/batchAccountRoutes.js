// routes/batchAccountRoutes.js
const express = require('express');
const router = express.Router();
const  authMiddleware  = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const { createBatchStudents, createBatchTeachers, createBatchAccounts, resetAccountsPassword, getAllAccounts, deleteAccounts } = require('../../controllers/user/batchAccountController');

// Tạo tài khoản hàng loạt - Chỉ Admin
router.post('/students', authMiddleware, checkPermission(PERMISSIONS.USER_CREATE, { checkContext: false }), createBatchStudents);
router.post('/teachers', authMiddleware, checkPermission(PERMISSIONS.USER_CREATE, { checkContext: false }), createBatchTeachers);
router.post('/accounts', authMiddleware, checkPermission(PERMISSIONS.USER_CREATE, { checkContext: false }), createBatchAccounts);
router.post('/reset-password', authMiddleware, checkPermission(PERMISSIONS.USER_UPDATE, { checkContext: false }), resetAccountsPassword);
router.get('/all-accounts', authMiddleware, checkPermission(PERMISSIONS.USER_VIEW, { checkContext: false }), getAllAccounts);
router.post('/delete-accounts', authMiddleware, checkPermission(PERMISSIONS.USER_DELETE, { checkContext: false }), deleteAccounts);


module.exports = router;

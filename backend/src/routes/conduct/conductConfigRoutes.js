const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const {
  getConductConfig,
  getConductConfigById,
  createConductConfig,
  updateConductConfig,
  deleteConductConfig,
  calculateConductsBatch,
} = require('../../controllers/conduct/conductConfigController');

// Tất cả routes đều cần xác thực
router.use(authMiddleware);

// 📋 Lấy danh sách cấu hình hạnh kiểm
router.get(
  '/',
  checkPermission([PERMISSIONS.CONDUCT_VIEW], { checkContext: false }),
  getConductConfig
);

// 📋 Lấy chi tiết cấu hình hạnh kiểm
router.get(
  '/:id',
  checkPermission([PERMISSIONS.CONDUCT_VIEW], { checkContext: false }),
  getConductConfigById
);

// ➕ Tạo cấu hình hạnh kiểm (Chỉ Admin)
router.post(
  '/',
  checkPermission([PERMISSIONS.CONDUCT_VIEW], { checkContext: false }),
  createConductConfig
);

// ✏️ Cập nhật cấu hình hạnh kiểm (Chỉ Admin)
router.put(
  '/:id',
  checkPermission([PERMISSIONS.CONDUCT_VIEW], { checkContext: false }),
  updateConductConfig
);

// 🗑️ Xóa cấu hình hạnh kiểm (Chỉ Admin)
router.delete(
  '/:id',
  checkPermission([PERMISSIONS.CONDUCT_VIEW], { checkContext: false }),
  deleteConductConfig
);

// 🧮 Tính toán hạnh kiểm tự động (Batch)
router.post(
  '/calculate',
  checkPermission([PERMISSIONS.CONDUCT_VIEW, PERMISSIONS.CONDUCT_ENTER], { checkContext: true }),
  calculateConductsBatch
);

module.exports = router;


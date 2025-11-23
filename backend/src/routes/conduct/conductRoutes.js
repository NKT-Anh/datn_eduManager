const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const {
  getConducts,
  getConductById,
  updateConduct,
  createConduct
} = require('../../controllers/conduct/conductController');

// Tất cả routes đều cần xác thực
router.use(authMiddleware);

// 📋 Lấy danh sách hạnh kiểm
router.get(
  '/',
  checkPermission([
    PERMISSIONS.CONDUCT_VIEW,
    PERMISSIONS.CONDUCT_ENTER
  ], { checkContext: true }),
  getConducts
);

// 📋 Lấy chi tiết hạnh kiểm
router.get(
  '/:id',
  checkPermission([
    PERMISSIONS.CONDUCT_VIEW,
    PERMISSIONS.CONDUCT_ENTER
  ], { checkContext: true }),
  getConductById
);

// ➕ Tạo hạnh kiểm (Chỉ Admin)
router.post(
  '/',
  checkPermission(PERMISSIONS.CONDUCT_VIEW, { checkContext: false }),
  createConduct
);

// ✏️ Cập nhật hạnh kiểm (GVCN nhập, Admin sửa)
router.put(
  '/:id',
  checkPermission([
    PERMISSIONS.CONDUCT_ENTER,
    PERMISSIONS.CONDUCT_VIEW
  ], { checkContext: true }),
  updateConduct
);

module.exports = router;


















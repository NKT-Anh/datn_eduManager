const express = require('express');
const router = express.Router();
const schoolYearController = require('../controllers/schoolYearController');
const authMiddleware = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/checkPermission');
const { PERMISSIONS } = require('../config/permissions');

// 📋 Lấy danh sách năm học - Tất cả roles có quyền xem
router.get(
  '/',
  authMiddleware,
  checkPermission(PERMISSIONS.YEAR_VIEW, { checkContext: false }),
  schoolYearController.getAllSchoolYears
);

// 🔍 Lấy năm học hiện tại (active)
router.get(
  '/current',
  authMiddleware,
  checkPermission(PERMISSIONS.YEAR_VIEW, { checkContext: false }),
  schoolYearController.getCurrentSchoolYear
);

// 🔍 Lấy chi tiết một năm học
router.get(
  '/:id',
  authMiddleware,
  checkPermission(PERMISSIONS.YEAR_VIEW, { checkContext: false }),
  schoolYearController.getSchoolYearById
);

// ➕ Tạo năm học mới - Chỉ Admin
router.post(
  '/',
  authMiddleware,
  checkPermission(PERMISSIONS.YEAR_MANAGE, { checkContext: false }),
  schoolYearController.createSchoolYear
);

// ✏️ Cập nhật năm học - Chỉ Admin
router.put(
  '/:id',
  authMiddleware,
  checkPermission(PERMISSIONS.YEAR_MANAGE, { checkContext: false }),
  schoolYearController.updateSchoolYear
);

// ✅ Kích hoạt năm học - Chỉ Admin
router.post(
  '/:id/activate',
  authMiddleware,
  checkPermission(PERMISSIONS.YEAR_MANAGE, { checkContext: false }),
  schoolYearController.activateSchoolYear
);

// 🚫 Ngừng kích hoạt năm học - Chỉ Admin
router.post(
  '/:id/deactivate',
  authMiddleware,
  checkPermission(PERMISSIONS.YEAR_MANAGE, { checkContext: false }),
  schoolYearController.deactivateSchoolYear
);

// 🗑️ Xóa năm học - Chỉ Admin
router.delete(
  '/:id',
  authMiddleware,
  checkPermission(PERMISSIONS.YEAR_MANAGE, { checkContext: false }),
  schoolYearController.deleteSchoolYear
);

// 🔄 Cập nhật trạng thái năm học - Chỉ Admin
router.patch(
  '/:id/status',
  authMiddleware,
  checkPermission(PERMISSIONS.YEAR_MANAGE, { checkContext: false }),
  schoolYearController.updateSchoolYearStatus
);



module.exports = router;


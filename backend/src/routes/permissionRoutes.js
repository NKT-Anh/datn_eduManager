const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const authMiddleware = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/checkPermission');
const { PERMISSIONS } = require('../config/permissions');

// ✅ Tất cả routes đều yêu cầu authentication
router.use(authMiddleware);

// ✅ Lấy tất cả permissions (có thể filter)
router.get(
  '/',
  checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }),
  permissionController.getAllPermissions
);

// ✅ Lấy permission theo ID
router.get(
  '/:id',
  checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }),
  permissionController.getPermissionById
);

// ✅ Lấy permission theo role và schoolYear
router.get(
  '/role/:role/year/:schoolYear',
  checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }),
  permissionController.getPermissionByRoleAndYear
);

// ✅ Tạo permission mới
router.post(
  '/',
  checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }),
  permissionController.createPermission
);

// ✅ Cập nhật permission
router.put(
  '/:id',
  checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }),
  permissionController.updatePermission
);

// ✅ Xóa permission
router.delete(
  '/:id',
  checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }),
  permissionController.deletePermission
);

// ✅ Sao chép permissions từ năm học này sang năm học khác
router.post(
  '/copy',
  checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }),
  permissionController.copyPermissionsFromYear
);

module.exports = router;




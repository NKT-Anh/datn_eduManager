const express = require('express');
const router = express.Router();
const studentController = require('../../controllers/user/studentController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const { auditLog } = require('../../middlewares/auditLogMiddleware');

// ✅ Danh sách học sinh - Tất cả roles có quyền xem (với context)
router.get('/', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_VIEW_HOMEROOM,
    PERMISSIONS.STUDENT_VIEW_TEACHING,
    PERMISSIONS.STUDENT_VIEW_SELF
  ], { checkContext: false }),
  studentController.getStudents
);

// ✅ Lấy 1 học sinh - Tất cả roles có quyền xem
router.get('/:id', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_VIEW_HOMEROOM,
    PERMISSIONS.STUDENT_VIEW_TEACHING,
    PERMISSIONS.STUDENT_VIEW_SELF
  ], { checkContext: true }),
  studentController.getStudentById
);

// ✅ Lấy thông tin chi tiết học sinh theo niên khóa - Tất cả roles có quyền xem
router.get('/:id/year-detail', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_VIEW_HOMEROOM,
    PERMISSIONS.STUDENT_VIEW_TEACHING,
    PERMISSIONS.STUDENT_VIEW_SELF
  ], { checkContext: true }),
  studentController.getStudentYearDetail
);

// ✅ Thêm học sinh - Chỉ Admin
router.post('/', 
  authMiddleware, 
  checkPermission(PERMISSIONS.STUDENT_CREATE),
  auditLog({
    action: 'CREATE',
    resource: 'STUDENT',
    getResourceName: (req) => req.body?.name || null,
    getDescription: (req) => `Tạo học sinh: ${req.body?.name || 'N/A'}`,
  }),
  studentController.createStudent
);

// ✅ Cập nhật học sinh - Chỉ Admin
router.put('/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.STUDENT_UPDATE),
  auditLog({
    action: 'UPDATE',
    resource: 'STUDENT',
    getResourceId: (req) => req.params.id,
    getResourceName: (req) => req.body?.name || null,
    getDescription: (req) => `Cập nhật học sinh: ${req.body?.name || req.params.id}`,
  }),
  studentController.updateStudent
);

// ✅ Xóa mềm học sinh - Chỉ Admin (không xóa thật)
router.delete('/:id',
  authMiddleware,
  checkPermission(PERMISSIONS.STUDENT_DELETE),
  auditLog({
    action: 'DELETE',
    resource: 'STUDENT',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `Xóa mềm học sinh: ${req.params.id}`,
  }),
  studentController.softDeleteStudent
);

// ✅ Khôi phục học sinh đã xóa mềm - Chỉ Admin
router.patch('/:id/restore',
  authMiddleware,
  checkPermission(PERMISSIONS.STUDENT_DELETE),
  auditLog({
    action: 'UPDATE',
    resource: 'STUDENT',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `Khôi phục học sinh: ${req.params.id}`,
  }),
  studentController.restoreStudent
);

// ✅ Xóa vĩnh viễn học sinh - Chỉ Admin (có thể force delete)
router.delete('/:id/force',
  authMiddleware,
  checkPermission(PERMISSIONS.STUDENT_DELETE),
  auditLog({
    action: 'DELETE',
    resource: 'STUDENT',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `Xóa vĩnh viễn học sinh: ${req.params.id}`,
  }),
  studentController.forceDeleteStudent
);

// ✅ Tự động phân lớp - Chỉ Admin
router.post("/auto-assign", 
  authMiddleware, 
  checkPermission(PERMISSIONS.STUDENT_UPDATE), 
  studentController.autoAssignToClasses
);

// ✅ Xét học sinh lên lớp và cập nhật năm học - Chỉ Admin
router.post("/promote", 
  authMiddleware, 
  checkPermission(PERMISSIONS.STUDENT_UPDATE),
  auditLog({
    action: 'UPDATE',
    resource: 'STUDENT',
    getDescription: (req) => `Xét học sinh lên lớp: ${req.body?.currentYear} → ${req.body?.newYear}`,
  }),
  studentController.promoteStudents
);

// ✅ Cập nhật năm học cho tất cả học sinh - Chỉ Admin
router.post("/update-year", 
  authMiddleware, 
  checkPermission(PERMISSIONS.STUDENT_UPDATE),
  auditLog({
    action: 'UPDATE',
    resource: 'STUDENT',
    getDescription: (req) => `Cập nhật năm học cho tất cả học sinh: ${req.body?.newYear}`,
  }),
  studentController.updateAllStudentsYear
);
 
module.exports = router;

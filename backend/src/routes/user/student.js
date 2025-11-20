const express = require('express');
const router = express.Router();
const studentController = require('../../controllers/user/studentController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

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

// ✅ Thêm học sinh - Chỉ Admin
router.post('/', 
  authMiddleware, 
  checkPermission(PERMISSIONS.STUDENT_CREATE), 
  studentController.createStudent
);

// ✅ Cập nhật học sinh - Chỉ Admin
router.put('/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.STUDENT_UPDATE), 
  studentController.updateStudent
);

// ✅ Xóa học sinh - Chỉ Admin
router.delete('/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.STUDENT_DELETE), 
  studentController.deleteStudent
);

// ✅ Tự động phân lớp - Chỉ Admin
router.post("/auto-assign", 
  authMiddleware, 
  checkPermission(PERMISSIONS.STUDENT_UPDATE), 
  studentController.autoAssignToClasses
);
 
module.exports = router;

const teachingAssignmentController = require('../../controllers/subject/teachingAssignmentController');
const autoAssignTeachingController = require('../../controllers/subject/autoAssignTeachingController');
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// ✅ Tạo phân công giảng dạy - Admin hoặc Trưởng bộ môn (cho giáo viên trong tổ)
router.post('/', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_CREATE,
    PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING
  ]), 
  teachingAssignmentController.createAssignment
);

// ✅ Danh sách phân công giảng dạy - Tất cả roles có quyền xem
router.get('/', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_SELF
  ], { checkContext: false }),
  teachingAssignmentController.getAllAssignments
);

// ✅ Lấy phân công giảng dạy theo giáo viên - Giáo viên xem của mình hoặc Admin/QLBM
router.get('/teacher/:teacherId', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_SELF
  ], { checkContext: false }),
  teachingAssignmentController.getAssignmentsByTeacher
);

// ✅ Cập nhật phân công giảng dạy - Admin hoặc Trưởng bộ môn (cho giáo viên trong tổ)
router.put('/:id', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_UPDATE,
    PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING
  ]), 
  teachingAssignmentController.updateAssignment
);

// ✅ Xóa phân công giảng dạy - Admin hoặc Trưởng bộ môn (cho giáo viên trong tổ)
router.delete('/:id', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_UPDATE,
    PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING
  ]), 
  teachingAssignmentController.deleteAssignment
);

// ✅ Tạo nhiều phân công giảng dạy - Chỉ Admin
router.post("/bulk", 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_CREATE), 
  teachingAssignmentController.createBulkAssignments
);

// ✅ Kiểm tra môn học thiếu giáo viên - Admin và QLBM có quyền xem
router.get("/check-missing", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT
  ], { checkContext: false }),
  teachingAssignmentController.checkMissingTeachers
);

// ✅ Phân công tự động - Chỉ Admin
router.post("/auto-assign", 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_CREATE), 
  autoAssignTeachingController.autoAssignTeaching
);

module.exports = router;

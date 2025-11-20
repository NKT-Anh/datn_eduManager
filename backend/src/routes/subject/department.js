const express = require('express');
const router = express.Router();
const departmentController = require('../../controllers/subject/departmentController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// ✅ Lấy tất cả tổ bộ môn - Tất cả roles có quyền xem
router.get('/', 
  authMiddleware, 
  checkPermission([PERMISSIONS.DEPARTMENT_VIEW, PERMISSIONS.DEPARTMENT_MANAGE], { checkContext: false }),
  departmentController.getAllDepartments
);

// ✅ Lấy 1 tổ bộ môn - Tất cả roles có quyền xem
router.get('/:id', 
  authMiddleware, 
  checkPermission([PERMISSIONS.DEPARTMENT_VIEW, PERMISSIONS.DEPARTMENT_MANAGE], { checkContext: false }),
  departmentController.getDepartment
);

// ✅ Tạo tổ bộ môn - Chỉ Admin
router.post('/', 
  authMiddleware, 
  checkPermission(PERMISSIONS.DEPARTMENT_CREATE), 
  departmentController.createDepartment
);

// ✅ Cập nhật tổ bộ môn - Admin hoặc Trưởng Bộ Môn
router.put('/:id', 
  authMiddleware, 
  checkPermission([PERMISSIONS.DEPARTMENT_UPDATE, PERMISSIONS.DEPARTMENT_MANAGE]), 
  departmentController.updateDepartment
);

// ✅ Xóa tổ bộ môn - Chỉ Admin
router.delete('/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.DEPARTMENT_DELETE), 
  departmentController.deleteDepartment
);

// ✅ Lấy danh sách giáo viên trong tổ - Trưởng Bộ Môn hoặc Admin
router.get('/:id/teachers', 
  authMiddleware, 
  checkPermission([PERMISSIONS.TEACHER_VIEW_DEPARTMENT, PERMISSIONS.DEPARTMENT_MANAGE], { checkContext: false }),
  departmentController.getDepartmentTeachers
);

// ✅ Lấy danh sách môn học trong tổ - Trưởng Bộ Môn hoặc Admin
router.get('/:id/subjects', 
  authMiddleware, 
  checkPermission([PERMISSIONS.SUBJECT_VIEW, PERMISSIONS.DEPARTMENT_MANAGE], { checkContext: false }),
  departmentController.getDepartmentSubjects
);

// ✅ Thống kê tổ bộ môn - Trưởng Bộ Môn hoặc Admin
router.get('/:id/stats', 
  authMiddleware, 
  checkPermission([PERMISSIONS.DASHBOARD_VIEW_DEPARTMENT, PERMISSIONS.DEPARTMENT_MANAGE], { checkContext: false }),
  departmentController.getDepartmentStats
);

// ✅ Thống kê phân công môn học theo tổ - Trưởng Bộ Môn hoặc Admin
router.get('/:id/assignment-stats',
  authMiddleware,
  checkPermission([PERMISSIONS.DASHBOARD_VIEW_DEPARTMENT, PERMISSIONS.DEPARTMENT_MANAGE], { checkContext: false }),
  departmentController.getDepartmentAssignmentStats
);

// ✅ Thêm giáo viên vào tổ bộ môn - Admin hoặc Trưởng Bộ Môn
router.post('/:id/teachers', 
  authMiddleware, 
  checkPermission([PERMISSIONS.DEPARTMENT_MANAGE, PERMISSIONS.TEACHER_UPDATE], { checkContext: false }),
  departmentController.addTeacherToDepartment
);

// ✅ Xóa giáo viên khỏi tổ bộ môn - Admin hoặc Trưởng Bộ Môn
router.delete('/:id/teachers', 
  authMiddleware, 
  checkPermission([PERMISSIONS.DEPARTMENT_MANAGE, PERMISSIONS.TEACHER_UPDATE], { checkContext: false }),
  departmentController.removeTeacherFromDepartment
);

// ✅ Thêm giáo viên vào tổ bộ môn (alternative route với body)
router.post('/:id/teachers/add', 
  authMiddleware, 
  checkPermission([PERMISSIONS.DEPARTMENT_MANAGE, PERMISSIONS.TEACHER_UPDATE], { checkContext: false }),
  departmentController.addTeacherToDepartment
);

module.exports = router;


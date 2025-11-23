const express = require('express');
const router = express.Router();
const departmentManagementController = require('../../controllers/subject/departmentManagementController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

/**
 * ✅ Quản lý Bộ Môn - Dành cho Trưởng Bộ Môn
 * 
 * Quyền:
 * - Quản lý giáo viên trong tổ (xem, thêm, xóa)
 * - Đề xuất phân công (tạo, xem, hủy)
 * - Xem thống kê tổ bộ môn
 * - Sử dụng các quyền của giáo viên bình thường (thông qua các route khác)
 */

// ✅ Dashboard quản lý bộ môn
router.get('/dashboard',
  authMiddleware,
  checkPermission([PERMISSIONS.DEPARTMENT_MANAGE, PERMISSIONS.DASHBOARD_VIEW_DEPARTMENT], { checkContext: false }),
  departmentManagementController.getDashboard
);

// ✅ Lấy danh sách giáo viên trong tổ (chi tiết)
router.get('/teachers',
  authMiddleware,
  checkPermission([PERMISSIONS.TEACHER_VIEW_DEPARTMENT, PERMISSIONS.DEPARTMENT_MANAGE], { checkContext: false }),
  departmentManagementController.getDepartmentTeachers
);

// ✅ Thêm giáo viên vào tổ bộ môn
router.post('/teachers',
  authMiddleware,
  checkPermission([PERMISSIONS.DEPARTMENT_MANAGE, PERMISSIONS.TEACHER_UPDATE], { checkContext: false }),
  departmentManagementController.addTeacher
);

// ✅ Xóa giáo viên khỏi tổ bộ môn
router.delete('/teachers/:teacherId',
  authMiddleware,
  checkPermission([PERMISSIONS.DEPARTMENT_MANAGE, PERMISSIONS.TEACHER_UPDATE], { checkContext: false }),
  departmentManagementController.removeTeacher
);

// ✅ Lấy danh sách đề xuất phân công
router.get('/proposals',
  authMiddleware,
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING, { checkContext: false }),
  departmentManagementController.getProposals
);

// ✅ Tạo đề xuất phân công
router.post('/proposals',
  authMiddleware,
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING, { checkContext: false }),
  departmentManagementController.createProposal
);

// ✅ Hủy đề xuất phân công
router.put('/proposals/:id/cancel',
  authMiddleware,
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING, { checkContext: false }),
  departmentManagementController.cancelProposal
);

// ✅ Hủy toàn bộ đề xuất (batch cancel)
router.put('/proposals/cancel-all',
  authMiddleware,
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING, { checkContext: false }),
  departmentManagementController.cancelAllProposals
);

// ✅ Tạo nhiều đề xuất phân công cùng lúc (batch)
router.post('/proposals/batch',
  authMiddleware,
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING, { checkContext: false }),
  departmentManagementController.createBatchProposals
);

// ✅ Lấy số tiết/tuần của môn học trong các lớp
router.get('/class-periods',
  authMiddleware,
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING, { checkContext: false }),
  departmentManagementController.getClassPeriodsForSubject
);

module.exports = router;


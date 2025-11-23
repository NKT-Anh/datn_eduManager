const express = require('express');
const router = express.Router();

const gradeController = require('../../controllers/grade/gradesController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const checkGradeEntryPeriod = require('../../middlewares/checkGradeEntryPeriod');

// ✅ Thêm hoặc cập nhật điểm (1 học sinh, 1 cột điểm) - GVBM (môn mình dạy) hoặc Admin
router.post('/items', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_ENTER, PERMISSIONS.GRADE_VIEW], { checkContext: true }), 
  checkGradeEntryPeriod, 
  gradeController.upsertGradeItem
);

// ✅ Lấy bảng tổng hợp điểm của 1 lớp + môn học - Tất cả roles có quyền xem
router.get('/summary', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.GRADE_VIEW,
    PERMISSIONS.GRADE_VIEW_ALL,
    PERMISSIONS.GRADE_VIEW_DEPARTMENT,
    PERMISSIONS.GRADE_VIEW_HOMEROOM,
    PERMISSIONS.GRADE_VIEW_TEACHING,
    PERMISSIONS.GRADE_VIEW_SELF
  ], { checkContext: false }),
  gradeController.getClassSubjectSummary
);

// ✅ Tính lại điểm tổng hợp - Chỉ Admin
router.post('/recompute', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW), 
  gradeController.recomputeSummary
);

// ✅ Lưu điểm nhiều học sinh cùng lúc - GVBM (môn mình dạy) hoặc Admin
router.post('/save', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_ENTER, PERMISSIONS.GRADE_VIEW], { checkContext: true }), 
  checkGradeEntryPeriod, 
  gradeController.saveScores
);

// ✅ Học sinh xem điểm của bản thân
router.get('/student', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW_SELF, { checkContext: true }), 
  gradeController.getStudentGrades
);

// ✅ Khởi tạo bảng điểm cho tất cả lớp - Chỉ Admin
router.post('/init', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW), 
  gradeController.initGradeTable
);

// ✅ Admin/BGH xem tất cả điểm của tất cả học sinh
router.get('/admin/all', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_ALL, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  gradeController.getAllStudentsGrades
);

// ✅ Thống kê điểm theo lớp/khối/năm học
router.get('/admin/statistics', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_ALL, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  gradeController.getStatistics
);

// ✅ Lịch sử nhập/sửa điểm
router.get('/admin/audit-log', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_ALL, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  gradeController.getAuditLog
);

// ✅ Admin cập nhật điểm
router.put('/admin/item/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW, { checkContext: false }), 
  gradeController.updateGradeItem
);

// ✅ Admin xóa điểm
router.delete('/admin/item/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW, { checkContext: false }), 
  gradeController.deleteGradeItem
);

module.exports = router;

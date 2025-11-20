// routes/exam/examRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/exam/examController');
const auth = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const checkExamLocked = require('../../middlewares/checkExamLocked');
const checkExamArchived = require('../../middlewares/checkExamArchived');

// ✅ CRUD cơ bản
// Tạo kỳ thi - Chỉ Admin
router.post('/', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_CREATE), 
  ctrl.createExam
);

// Xem danh sách kỳ thi - Tất cả roles có quyền xem (với context)
router.get('/', 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }), // Tắt context check cho list view
  ctrl.getExams
);

// Xem chi tiết kỳ thi - Tất cả roles có quyền xem
router.get('/:id', 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getExamById
);

// Cập nhật kỳ thi - Chỉ Admin
router.put('/:id', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  checkExamLocked, 
  checkExamArchived, 
  ctrl.updateExam
);

// Xóa kỳ thi - Chỉ Admin
router.delete('/:id', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_DELETE), 
  checkExamLocked, 
  checkExamArchived, 
  ctrl.deleteExam
);

// ✅ Chức năng nâng cao
// Khóa kỳ thi - Chỉ Admin
router.patch('/:id/lock', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.lockExam
);

// Lưu trữ kỳ thi - Chỉ Admin
router.patch('/:id/archive', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.archiveExam
);

// Clone kỳ thi - Chỉ Admin
router.post('/:id/clone', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_CREATE), 
  ctrl.cloneExam
);

// Thống kê kỳ thi - Tất cả roles có quyền xem
router.get('/:id/stats', 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getExamStats
);

// Tổng hợp trạng thái - Chỉ Admin và BGH
router.get('/summary/status', 
  auth, 
  checkPermission([PERMISSIONS.EXAM_VIEW, PERMISSIONS.DASHBOARD_VIEW_ALL], { checkContext: false }), 
  ctrl.getExamSummary
);

// Thống kê theo năm - Chỉ Admin và BGH
router.get('/summary/year', 
  auth, 
  checkPermission([PERMISSIONS.EXAM_VIEW, PERMISSIONS.DASHBOARD_VIEW_ALL], { checkContext: false }), 
  ctrl.getYearlyStats
);

module.exports = router;

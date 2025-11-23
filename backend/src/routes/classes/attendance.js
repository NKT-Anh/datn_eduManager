const express = require('express');
const router = express.Router();
const attendanceController = require('../../controllers/class/attendanceController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// 📋 Điểm danh cho lớp (GVCN điểm danh theo buổi)
router.post('/take', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_CREATE, PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: true }), 
  attendanceController.takeAttendance
);

// 📋 Lấy danh sách điểm danh
router.get('/', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.ATTENDANCE_VIEW_CLASS, 
    PERMISSIONS.ATTENDANCE_VIEW_ALL, 
    PERMISSIONS.ATTENDANCE_VIEW_SELF
  ], { checkContext: true }), 
  attendanceController.getAttendance
);

// 📋 Cập nhật điểm danh (GVCN hoặc Admin)
router.put('/:id', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_UPDATE, PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: true }), 
  attendanceController.updateAttendance
);

// 📋 Xóa điểm danh (Chỉ Admin)
router.delete('/:id', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_DELETE, PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }), 
  attendanceController.deleteAttendance
);

// 📋 Lấy thống kê điểm danhd
router.get('/stats', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.ATTENDANCE_STATS, 
    PERMISSIONS.ATTENDANCE_VIEW_CLASS, 
    PERMISSIONS.ATTENDANCE_VIEW_ALL, 
    PERMISSIONS.ATTENDANCE_VIEW_SELF
  ], { checkContext: true }), 
  attendanceController.getAttendanceStats
);

// 📋 Lấy danh sách học sinh trong lớp để điểm danh (GVCN)
router.get('/class/:classId/students', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_CREATE, PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: true }), 
  attendanceController.getStudentsForAttendance
);

// 📋 Lấy lịch sử chỉnh sửa điểm danh (BGH/Admin)
router.get('/edit-history', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }), 
  attendanceController.getAttendanceEditHistory
);

module.exports = router;







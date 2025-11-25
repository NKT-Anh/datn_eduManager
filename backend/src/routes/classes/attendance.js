const express = require('express');
const router = express.Router();
const attendanceController = require('../../controllers/class/attendanceController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const { auditLog } = require('../../middlewares/auditLogMiddleware');
const { getClassName } = require('../../utils/auditLogHelpers');

// 📋 Điểm danh cho lớp (GVCN điểm danh theo buổi)
router.post('/take', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_CREATE, PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: true }),
  auditLog({
    action: 'CREATE',
    resource: 'ATTENDANCE',
    getDescription: async (req) => {
      const classId = req.body?.classId;
      const date = req.body?.date || 'N/A';
      const className = await getClassName(classId);
      return `Điểm danh lớp: ${className}, Ngày: ${date}`;
    },
  }),
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
  auditLog({
    action: 'UPDATE',
    resource: 'ATTENDANCE',
    getResourceId: (req) => req.params.id,
    getDescription: async (req) => {
      // Lấy thông tin điểm danh trước khi cập nhật
      try {
        const Attendance = require('../../models/class/attendance');
        const attendance = await Attendance.findById(req.params.id)
          .populate('studentId', 'name studentCode')
          .populate('classId', 'className')
          .lean();
        
        if (attendance) {
          const studentName = attendance.studentId ? `${attendance.studentId.name} (${attendance.studentId.studentCode || ''})` : 'N/A';
          const className = attendance.classId?.className || 'N/A';
          const date = attendance.date ? new Date(attendance.date).toLocaleDateString('vi-VN') : 'N/A';
          return `Cập nhật điểm danh: Học sinh ${studentName}, Lớp ${className}, Ngày ${date}`;
        }
      } catch (e) {
        // Ignore error
      }
      return `Cập nhật điểm danh: ${req.params.id}`;
    },
  }),
  attendanceController.updateAttendance
);

// 📋 Xóa điểm danh (Chỉ Admin)
router.delete('/:id', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_DELETE, PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }),
  auditLog({
    action: 'DELETE',
    resource: 'ATTENDANCE',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `Xóa điểm danh: ${req.params.id}`,
  }),
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

// 📊 Thống kê chi tiết theo lớp (Admin)
router.get('/stats/by-class', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }), 
  attendanceController.getAttendanceStatsByClass
);

// 📊 Thống kê theo khối (Admin)
router.get('/stats/by-grade', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }), 
  attendanceController.getAttendanceStatsByGrade
);

// 📈 Xu hướng điểm danh (Admin)
router.get('/stats/trends', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }), 
  attendanceController.getAttendanceTrends
);

// 📊 Thống kê tổng quan (Admin)
router.get('/stats/overview', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }), 
  attendanceController.getAttendanceOverview
);

// 📊 Thống kê hôm nay cho BGH
router.get('/stats/today', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }), 
  attendanceController.getTodayAttendanceStats
);

// 🔔 Cảnh báo điểm danh cho BGH
router.get('/alerts', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }), 
  attendanceController.getAttendanceAlerts
);

// 📋 Điểm danh theo lớp hôm nay cho BGH
router.get('/class/:classId/today', 
  authMiddleware, 
  checkPermission([PERMISSIONS.ATTENDANCE_VIEW_ALL], { checkContext: false }), 
  attendanceController.getTodayAttendanceByClass
);

module.exports = router;







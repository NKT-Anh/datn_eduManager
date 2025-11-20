const express = require('express');
const router = express.Router();
const attendanceController = require('../../controllers/class/attendanceController');
const authMiddleware = require('../../middlewares/authMiddleware');

// 📋 Điểm danh cho lớp (giáo viên)
router.post('/take', authMiddleware, attendanceController.takeAttendance);

// 📋 Lấy danh sách điểm danh
router.get('/', authMiddleware, attendanceController.getAttendance);

// 📋 Cập nhật điểm danh (admin hoặc giáo viên đã điểm danh)
router.put('/:id', authMiddleware, attendanceController.updateAttendance);

// 📋 Lấy thống kê điểm danh
router.get('/stats', authMiddleware, attendanceController.getAttendanceStats);

// 📋 Lấy danh sách học sinh trong lớp để điểm danh
router.get('/class/:classId/students', authMiddleware, attendanceController.getStudentsForAttendance);

module.exports = router;







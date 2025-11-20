const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/studentExamController");
const auth = require("../../middlewares/authMiddleware");
const checkPermission = require("../../middlewares/checkPermission");
const { PERMISSIONS } = require("../../config/permissions");

// ✅ Lấy danh sách kỳ thi học sinh đang tham gia - Học sinh xem bản thân
router.get("/student/:studentId/exams", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_VIEW_SELF, { checkContext: true }), 
  ctrl.getExamsByStudent
);

// ✅ Lấy lịch thi trong kỳ - Học sinh xem bản thân
router.get("/exam/:examId/student/:studentId/schedules", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_VIEW_SELF, { checkContext: true }), 
  ctrl.getScheduleByStudent
);

// ✅ Lấy thông tin phòng thi & chỗ ngồi - Học sinh xem bản thân
router.get("/schedule/:scheduleId/student/:studentId/room", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_VIEW_SELF, { checkContext: true }), 
  ctrl.getRoomByStudent
);

// ✅ Lấy điểm của học sinh - Học sinh xem bản thân
router.get("/exam/:examId/student/:studentId/grades", 
  auth, 
  checkPermission(PERMISSIONS.GRADE_VIEW_SELF, { checkContext: true }), 
  ctrl.getGradesByStudent
);

module.exports = router;

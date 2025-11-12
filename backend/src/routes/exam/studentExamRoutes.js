const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/studentExamController");
const auth = require("../../middlewares/authMiddleware");

// 📋 Lấy danh sách kỳ thi học sinh đang tham gia
router.get("/student/:studentId/exams", auth, ctrl.getExamsByStudent);

// 🗓️ Lấy lịch thi trong kỳ
router.get("/exam/:examId/student/:studentId/schedules", auth, ctrl.getScheduleByStudent);

// 🏫 Lấy thông tin phòng thi & chỗ ngồi
router.get("/schedule/:scheduleId/student/:studentId/room", auth, ctrl.getRoomByStudent);

// 🧮 Lấy điểm của học sinh
router.get("/exam/:examId/student/:studentId/grades", auth, ctrl.getGradesByStudent);

module.exports = router;

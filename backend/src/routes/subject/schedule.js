const express = require("express");
const router = express.Router();
const scheduleController = require("../../controllers/subject/scheduleController");

router.get("/", scheduleController.getAllSchedules);

// Lấy theo lớp + năm + học kỳ
router.get("/:classId/:year/:semester", scheduleController.getScheduleByClass);

// Tạo mới
router.post("/", scheduleController.createSchedule);

// Cập nhật
router.put("/:id", scheduleController.updateSchedule);

// Xóa
router.delete("/:id", scheduleController.deleteSchedule);

router.post("/delete-by-grade-year-semester", scheduleController.deleteScheduleByGradeYearSemester);

router.get("/year/:year/semester/:semester", scheduleController.getSchedulesByYearSemester); // 🆕 toàn trường
router.get("/grade/:grade/year/:year/semester/:semester", scheduleController.getSchedulesByGrade); // 🆕 theo khối




module.exports = router;

const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/examScheduleController");
const auth = require("../../middlewares/authMiddleware");

/* =========================================================
   📋 CRUD CƠ BẢN + LỌC THEO KỲ THI
========================================================= */

// 🔹 Lấy tất cả (toàn hệ thống)
router.get("/", ctrl.getAllSchedules);

// 🔹 Lấy lịch thi theo kỳ thi + khối (chuẩn REST)
router.get("/:examId", ctrl.getSchedulesByExam);

// 🔹 Lấy 1 lịch thi cụ thể
router.get("/detail/:id", ctrl.getScheduleById);

// 🔹 Tạo mới, cập nhật, xóa
router.post("/", auth, ctrl.createSchedule);
router.put("/:id", auth, ctrl.updateSchedule);
router.delete("/:id", auth, ctrl.deleteSchedule);

/* =========================================================
   ⚡ HÀNH ĐỘNG MỞ RỘNG
========================================================= */
router.post("/auto-generate", auth, ctrl.autoGenerateSchedules);
router.get("/stats/:examId", ctrl.getScheduleStats);
router.put("/:id/status", auth, ctrl.updateStatus);

module.exports = router;

const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/examRoomController");
const auth = require("../../middlewares/authMiddleware");

/* =========================================================
   ⚡ PHÒNG THI - API CHÍNH
========================================================= */

// 🏫 Lấy tất cả phòng thi theo kỳ thi
router.get("/exam/:examId", ctrl.getByExam);

// 🏫 Lấy tất cả phòng theo lịch thi
router.get("/schedule/:scheduleId", ctrl.getRoomsBySchedule);

// 📊 Thống kê phòng
router.get("/stats/:examId", ctrl.getRoomStats);

// 📄 Xuất danh sách PDF (đặt sau các route tĩnh)
router.get("/:roomId/export/pdf", ctrl.exportRoomList);

/* =========================================================
   📋 CRUD CƠ BẢN
========================================================= */
router.get("/", ctrl.getRooms);
router.post("/", auth, ctrl.createRoom);
router.put("/:id", auth, ctrl.updateRoom);
router.delete("/:id", auth, ctrl.deleteRoom);

/* =========================================================
   ⚡ TẠO PHÒNG TỰ ĐỘNG & PHÂN CHIA HỌC SINH
========================================================= */
router.post("/auto-generate", auth, ctrl.autoGenerateRooms);
router.post("/auto-distribute", auth, ctrl.autoDistributeStudents);

/* =========================================================
   👩‍🏫 GÁN GIÁM THỊ
========================================================= */
router.put("/:roomId/invigilators", auth, ctrl.assignInvigilators);
router.post("/auto-assign-invigilators", auth, ctrl.autoAssignInvigilators);


module.exports = router;

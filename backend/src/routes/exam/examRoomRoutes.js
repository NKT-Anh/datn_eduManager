const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/examRoomController");
const auth = require("../../middlewares/authMiddleware");
const checkPermission = require("../../middlewares/checkPermission");
const { PERMISSIONS } = require("../../config/permissions");

/* =========================================================
   ⚡ PHÒNG THI - API CHÍNH
========================================================= */

// 🏫 Lấy tất cả phòng thi theo kỳ thi - Tất cả roles có quyền xem
router.get("/exam/:examId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getByExam
);

// 🏫 Lấy danh sách phòng học khả dụng - Chỉ Admin
router.get("/exam/:examId/available", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.getAvailableRooms
);

// 🏫 Lấy tất cả phòng theo lịch thi - Tất cả roles có quyền xem
router.get("/schedule/:scheduleId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getRoomsBySchedule
);

// 📊 Thống kê phòng - Tất cả roles có quyền xem
router.get("/stats/:examId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getRoomStats
);

// 📊 Lấy số phòng khả dụng - Chỉ Admin
router.get("/available-count", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.getAvailableRoomsCount
);

// 📄 Xuất danh sách PDF - Tất cả roles có quyền xem
router.get("/:roomId/export/pdf", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.exportRoomList
);

/* =========================================================
   📋 CRUD CƠ BẢN
========================================================= */
// Xem danh sách phòng thi - Tất cả roles có quyền xem
router.get("/", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getRooms
);

// Tạo phòng thi - Chỉ Admin
router.post("/", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.createRoom
);

// Cập nhật phòng thi - Chỉ Admin
router.put("/:id", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.updateRoom
);

// Xóa phòng thi - Chỉ Admin
router.delete("/:id", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.deleteRoom
);

/* =========================================================
   ⚡ TẠO PHÒNG TỰ ĐỘNG & PHÂN CHIA HỌC SINH
========================================================= */
// Tạo phòng tự động - Chỉ Admin
router.post("/auto-generate", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_AUTO), 
  ctrl.autoGenerateRooms
);

// Phân chia học sinh tự động - Chỉ Admin
router.post("/auto-distribute", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_AUTO), 
  ctrl.autoDistributeStudents
);

/* =========================================================
   👩‍🏫 GÁN GIÁM THỊ
========================================================= */
// Gán giám thị thủ công - Chỉ Admin
router.put("/:roomId/invigilators", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.assignInvigilators
);

// Gán giám thị tự động cho 1 schedule - Chỉ Admin
router.post("/auto-assign-invigilators", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.autoAssignInvigilators
);

// Gán giám thị tự động cho toàn bộ kỳ thi - Chỉ Admin
router.post("/auto-assign-invigilators-for-exam", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.autoAssignInvigilatorsForExam
);

// Xóa toàn bộ giám thị - Chỉ Admin
router.post("/remove-all-invigilators", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.removeAllInvigilatorsFromExam
);

/* =========================================================
   🏫 PHÂN PHÒNG CỐ ĐỊNH
========================================================= */
// Lấy danh sách phòng cố định - Tất cả roles có quyền xem
router.get("/fixed-rooms", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getFixedRooms
);

// Phân học sinh vào phòng cố định - Chỉ Admin
router.post("/assign-to-fixed-rooms", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_AUTO), 
  ctrl.assignStudentsToFixedRooms
);

// Phân phòng cố định vào phòng thi - Chỉ Admin
router.post("/assign-fixed-to-exam-rooms", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_AUTO), 
  ctrl.assignFixedRoomsToExamRooms
);

// Phân phòng nhóm vào tất cả phòng thi - Chỉ Admin
router.post("/assign-fixed-to-all-schedules", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_AUTO), 
  ctrl.assignFixedRoomsToAllSchedules
);

// Cập nhật phòng cố định - Chỉ Admin
router.put("/fixed-rooms/:id", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.updateFixedRoom
);

// Di chuyển FixedExamRoom - Chỉ Admin
router.post("/move-fixed-room", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.moveFixedRoom
);

module.exports = router;

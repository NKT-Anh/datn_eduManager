const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/roomAssignmentController");
const auth = require("../../middlewares/authMiddleware");
const checkPermission = require("../../middlewares/checkPermission");
const { PERMISSIONS } = require("../../config/permissions");

// ✅ Phân phòng thủ công - Chỉ Admin
router.post("/manual", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_AUTO), 
  ctrl.manualAssignRoom
);

// ✅ Phân phòng tự động - Chỉ Admin
router.post("/auto/:scheduleId", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_AUTO), 
  ctrl.autoAssignRooms
);

// ✅ Lấy danh sách phân phòng theo lịch thi - Tất cả roles có quyền xem
router.get("/schedule/:scheduleId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getAssignmentsBySchedule
);

// ✅ Lấy danh sách phân phòng (alias) - Tất cả roles có quyền xem
router.get("/:scheduleId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getAssignmentsBySchedule
);

// ✅ Cập nhật phân phòng - Chỉ Admin
router.put("/:id", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.updateAssignment
);

// ✅ Reset phân phòng - Chỉ Admin
router.delete("/reset/:scheduleId", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_MANAGE), 
  ctrl.resetAssignments
);

// ✅ Xuất danh sách PDF - Tất cả roles có quyền xem
router.get("/export/:scheduleId/pdf", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF,
    PERMISSIONS.EXAM_PRINT_TICKET,
    PERMISSIONS.EXAM_PRINT_TICKET_HOMEROOM,
    PERMISSIONS.EXAM_PRINT_TICKET_TEACHING,
    PERMISSIONS.EXAM_PRINT_TICKET_SELF
  ], { checkContext: false }),
  ctrl.exportRoomList
);

module.exports = router;

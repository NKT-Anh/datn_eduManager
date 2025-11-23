const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/teacherExamController");
const auth = require("../../middlewares/authMiddleware");
const checkPermission = require("../../middlewares/checkPermission");
const { PERMISSIONS } = require("../../config/permissions");

// ✅ Lấy danh sách phòng thi giáo viên được phân công - Giáo viên xem của mình
router.get("/teacher/:teacherId/rooms", 
  auth, 
  checkPermission([PERMISSIONS.EXAM_ROOM_VIEW, PERMISSIONS.EXAM_ROOM_VIEW_MANAGE], { checkContext: false }), 
  ctrl.getRoomsByTeacher
);

// ✅ Lấy lịch coi thi của giáo viên - Giáo viên xem của mình
router.get("/teacher/:teacherId/schedules", 
  auth, 
  checkPermission([PERMISSIONS.EXAM_VIEW, PERMISSIONS.EXAM_VIEW_TEACHING], { checkContext: false }), 
  ctrl.getSchedulesByTeacher
);

module.exports = router;

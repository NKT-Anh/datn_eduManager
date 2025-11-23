const express = require("express");
const router = express.Router();
const scheduleController = require("../../controllers/subject/scheduleController");
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// ✅ Danh sách thời khóa biểu - Tất cả roles có quyền xem
router.get("/", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_VIEW_ALL,
    PERMISSIONS.SCHEDULE_VIEW_DEPARTMENT,
    PERMISSIONS.SCHEDULE_VIEW_HOMEROOM,
    PERMISSIONS.SCHEDULE_VIEW_TEACHING,
    PERMISSIONS.SCHEDULE_VIEW_SELF
  ], { checkContext: false }),
  scheduleController.getAllSchedules
);

// ✅ Lấy theo lớp + năm + học kỳ - Tất cả roles có quyền xem
router.get("/:classId/:year/:semester", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_VIEW_ALL,
    PERMISSIONS.SCHEDULE_VIEW_DEPARTMENT,
    PERMISSIONS.SCHEDULE_VIEW_HOMEROOM,
    PERMISSIONS.SCHEDULE_VIEW_TEACHING,
    PERMISSIONS.SCHEDULE_VIEW_SELF
  ], { checkContext: true }),
  scheduleController.getScheduleByClass
);

// ✅ Tạo mới - Chỉ Admin
router.post("/", 
  authMiddleware, 
  checkPermission(PERMISSIONS.SCHEDULE_CREATE), 
  scheduleController.createSchedule
);

// ✅ Cập nhật - Chỉ Admin
router.put("/:id", 
  authMiddleware, 
  checkPermission(PERMISSIONS.SCHEDULE_UPDATE), 
  scheduleController.updateSchedule
);

// ✅ Xóa - Chỉ Admin
router.delete("/:id", 
  authMiddleware, 
  checkPermission(PERMISSIONS.SCHEDULE_UPDATE), 
  scheduleController.deleteSchedule
);

// ✅ Xóa theo khối + năm + học kỳ - Chỉ Admin
router.post("/delete-by-grade-year-semester", 
  authMiddleware, 
  checkPermission(PERMISSIONS.SCHEDULE_UPDATE), 
  scheduleController.deleteScheduleByGradeYearSemester
);

// ✅ Lấy theo năm + học kỳ - Tất cả roles có quyền xem
router.get("/year/:year/semester/:semester", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.SCHEDULE_VIEW_ALL,
    PERMISSIONS.SCHEDULE_VIEW_DEPARTMENT,
    PERMISSIONS.SCHEDULE_VIEW_HOMEROOM,
    PERMISSIONS.SCHEDULE_VIEW_TEACHING
  ], { checkContext: false }),
  scheduleController.getSchedulesByYearSemester
);

// ✅ Lấy theo khối + năm + học kỳ - Tất cả roles có quyền xem
router.get("/grade/:grade/year/:year/semester/:semester", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.SCHEDULE_VIEW_ALL,
    PERMISSIONS.SCHEDULE_VIEW_DEPARTMENT,
    PERMISSIONS.SCHEDULE_VIEW_HOMEROOM,
    PERMISSIONS.SCHEDULE_VIEW_TEACHING
  ], { checkContext: false }),
  scheduleController.getSchedulesByGrade
);

// ✅ Lấy theo giáo viên + năm + học kỳ - Giáo viên xem của mình hoặc Admin
router.get("/teacher/:teacherName/:year/:semester", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.SCHEDULE_VIEW_ALL,
    PERMISSIONS.SCHEDULE_VIEW_TEACHING
  ], { checkContext: false }),
  scheduleController.getScheduleByTeacher
);

module.exports = router;

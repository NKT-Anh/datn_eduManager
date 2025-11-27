const express = require("express");
const router = express.Router();
const scheduleController = require("../../controllers/subject/scheduleController");
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const { auditLog } = require('../../middlewares/auditLogMiddleware');

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
  auditLog({
    action: 'UPDATE',
    resource: 'SCHEDULE',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `BGH cập nhật/duyệt thời khóa biểu: ${req.params.id}, Lớp ${req.body?.classId || 'N/A'}`,
  }),
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
// ✅ Sử dụng teacherId thay vì teacherName để tránh trùng tên
router.get("/teacher/:teacherId/:year/:semester", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.SCHEDULE_VIEW_ALL,
    PERMISSIONS.SCHEDULE_VIEW_TEACHING
  ], { checkContext: false }),
  scheduleController.getScheduleByTeacher
);

// ✅ Khóa/Mở khóa thời khóa biểu - Chỉ Admin
router.patch("/:id/lock", 
  authMiddleware, 
  checkPermission(PERMISSIONS.SCHEDULE_UPDATE),
  auditLog({
    action: 'UPDATE',
    resource: 'SCHEDULE',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `${req.body.isLocked ? 'Khóa' : 'Mở khóa'} thời khóa biểu: ${req.params.id}`,
  }),
  scheduleController.lockSchedule
);

// ✅ Khóa tất cả lịch trong năm học + học kỳ - Chỉ Admin
router.post("/lock-all", 
  authMiddleware, 
  checkPermission(PERMISSIONS.SCHEDULE_UPDATE),
  auditLog({
    action: 'UPDATE',
    resource: 'SCHEDULE',
    getResourceId: () => 'all',
    getDescription: (req) => `Khóa tất cả thời khóa biểu: ${req.body.year} - HK ${req.body.semester}`,
  }),
  scheduleController.lockAllSchedules
);

module.exports = router;

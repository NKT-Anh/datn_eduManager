const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/examScheduleController");
const auth = require("../../middlewares/authMiddleware");
const checkPermission = require("../../middlewares/checkPermission");
const { PERMISSIONS } = require("../../config/permissions");

/* =========================================================
   📋 CRUD CƠ BẢN + LỌC THEO KỲ THI
========================================================= */

// 🔹 Lấy tất cả (toàn hệ thống) - Tất cả roles có quyền xem
router.get("/", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getAllSchedules
);

// 🔹 Lấy 1 lịch thi cụ thể - Tất cả roles có quyền xem
router.get("/detail/:id", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getScheduleById
);

// ⚡ HÀNH ĐỘNG MỞ RỘNG (phải đặt trước /:examId để tránh match sai)
// Tạo lịch thi tự động - Chỉ Admin
router.post("/auto-generate", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_SCHEDULE_AUTO), 
  ctrl.autoGenerateSchedules
);

// Xóa nhiều lịch thi - Chỉ Admin
router.post("/delete-multiple", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.deleteMultipleSchedules
);

// Thống kê lịch thi - Tất cả roles có quyền xem
router.get("/stats/:examId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getScheduleStats
);

// Cập nhật ngày giờ lịch thi - Chỉ Admin
router.patch("/:id/datetime", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.updateDateTime
);

// Cập nhật trạng thái lịch thi - Chỉ Admin
router.put("/:id/status", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.updateStatus
);

// 🔹 Lấy lịch thi theo kỳ thi + khối - Tất cả roles có quyền xem
router.get("/:examId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getSchedulesByExam
);

// 🔹 Tạo mới, cập nhật, xóa - Chỉ Admin
router.post("/", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.createSchedule
);

router.put("/:id", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.updateSchedule
);

router.delete("/:id", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.deleteSchedule
);

module.exports = router;

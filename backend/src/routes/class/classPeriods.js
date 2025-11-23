/**
 * ============================================================================
 * 📚 ROUTES: PHÂN BỔ SỐ TIẾT THEO LỚP (Class Periods)
 * ============================================================================
 * 
 * API endpoints để quản lý phân bổ số tiết/tuần cho từng môn học và hoạt động
 * theo từng lớp, năm học và học kỳ.
 * 
 * Base URL: /api/classPeriods
 * 
 * Routes:
 * - GET    /                    - Lấy danh sách phân bổ số tiết (có filter)
 * - GET    /:id                 - Lấy phân bổ số tiết theo ID
 * - POST   /                    - Tạo/cập nhật phân bổ số tiết cho một lớp
 * - POST   /bulk                - Lưu phân bổ số tiết cho nhiều lớp cùng lúc
 * - PUT    /:id                 - Cập nhật phân bổ số tiết theo ID
 * - DELETE /:id                 - Xóa phân bổ số tiết
 * 
 * ============================================================================
 */

const express = require("express");
const router = express.Router();
const classPeriodsController = require("../../controllers/class/classPeriodsController");
const authMiddleware = require("../../middlewares/authMiddleware");
const checkPermission = require("../../middlewares/checkPermission");
const { PERMISSIONS } = require("../../config/permissions");

// ✅ GET /api/classPeriods - Lấy danh sách phân bổ số tiết
// Query params: year, semester, grade, classId
router.get(
  "/",
  authMiddleware,
  checkPermission([PERMISSIONS.CLASS_VIEW, PERMISSIONS.CLASS_VIEW_HOMEROOM]),
  classPeriodsController.getClassPeriods
);

// ✅ POST /api/classPeriods - Tạo hoặc cập nhật phân bổ số tiết cho một lớp
// Body: { year, semester, grade, classId, subjectPeriods, activityPeriods }
router.post(
  "/",
  authMiddleware,
  checkPermission([PERMISSIONS.CLASS_UPDATE]),
  classPeriodsController.upsertClassPeriods
);

// ✅ POST /api/classPeriods/bulk - Bulk upsert (lưu nhiều lớp cùng lúc)
// Body: { year, semester, grade, classPeriodsList: [{ classId, subjectPeriods, activityPeriods }] }
// ⚠️ Phải đặt trước route /:id để tránh conflict
router.post(
  "/bulk",
  authMiddleware,
  checkPermission([PERMISSIONS.CLASS_UPDATE]),
  classPeriodsController.bulkUpsertClassPeriods
);

// ✅ GET /api/classPeriods/export/excel - Xuất file Excel phân bổ số tiết
// Query params: year, semester
// ⚠️ Phải đặt trước route /:id để tránh conflict
router.get(
  "/export/excel",
  authMiddleware,
  checkPermission([PERMISSIONS.CLASS_VIEW, PERMISSIONS.CLASS_VIEW_HOMEROOM]),
  classPeriodsController.exportClassPeriodsToExcel
);

// ✅ GET /api/classPeriods/calculate-teachers - Tính số giáo viên tự động
// Query params: year, weeklyLessons (mặc định 19)
// ⚠️ Phải đặt trước route /:id để tránh conflict
router.get(
  "/calculate-teachers",
  authMiddleware,
  checkPermission([PERMISSIONS.CLASS_VIEW, PERMISSIONS.CLASS_VIEW_HOMEROOM]),
  classPeriodsController.calculateRequiredTeachers
);

// ✅ GET /api/classPeriods/:id - Lấy phân bổ số tiết theo ID
// ⚠️ Phải đặt sau route /bulk để tránh conflict
router.get(
  "/:id",
  authMiddleware,
  checkPermission([PERMISSIONS.CLASS_VIEW, PERMISSIONS.CLASS_VIEW_HOMEROOM]),
  classPeriodsController.getClassPeriodsById
);

// ✅ PUT /api/classPeriods/:id - Cập nhật phân bổ số tiết theo ID
// Body: { subjectPeriods, activityPeriods }
router.put(
  "/:id",
  authMiddleware,
  checkPermission([PERMISSIONS.CLASS_UPDATE]),
  classPeriodsController.updateClassPeriodsById
);

// ✅ DELETE /api/classPeriods/:id - Xóa phân bổ số tiết
router.delete(
  "/:id",
  authMiddleware,
  checkPermission([PERMISSIONS.CLASS_DELETE]),
  classPeriodsController.deleteClassPeriods
);

module.exports = router;


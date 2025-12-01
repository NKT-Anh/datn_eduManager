const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/examGradeController");
const auth = require("../../middlewares/authMiddleware");
const checkPermission = require("../../middlewares/checkPermission");
const { PERMISSIONS } = require("../../config/permissions");
const upload = require("../../middlewares/uploadMiddleware");

/* =========================================================
   🎓 API ROUTES - ĐIỂM THI (ExamGrade)
========================================================= */

// 📥 Import điểm từ file Excel - GVBM (môn mình dạy) hoặc Admin
router.post("/import", 
  auth, 
  checkPermission([PERMISSIONS.EXAM_GRADE_ENTER, PERMISSIONS.EXAM_UPDATE], { checkContext: true }), 
  upload.single("file"), 
  ctrl.importGradesFromExcel
);

// 📤 Export điểm ra Excel - Tất cả roles có quyền xem
router.get("/export/:examId", 
  auth, 
  checkPermission([
    PERMISSIONS.GRADE_VIEW,
    PERMISSIONS.GRADE_VIEW_ALL,
    PERMISSIONS.GRADE_VIEW_DEPARTMENT,
    PERMISSIONS.GRADE_VIEW_HOMEROOM,
    PERMISSIONS.GRADE_VIEW_TEACHING,
    PERMISSIONS.GRADE_VIEW_SELF
  ], { checkContext: false }),
  ctrl.exportGradesToExcel
);

// 🔒 Khóa toàn bộ điểm của kỳ thi - Chỉ Admin
router.put("/exam/:examId/lock", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.lockGrades
);

// 🗑️ Reset toàn bộ điểm của kỳ thi - Chỉ Admin
router.delete("/exam/:examId/reset", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.resetGrades
);

// 📊 Lấy thống kê điểm theo môn - Tất cả roles có quyền xem
router.get("/exam/:examId/stats", 
  auth, 
  checkPermission([
    PERMISSIONS.GRADE_VIEW,
    PERMISSIONS.GRADE_VIEW_ALL,
    PERMISSIONS.GRADE_VIEW_DEPARTMENT,
    PERMISSIONS.GRADE_VIEW_HOMEROOM,
    PERMISSIONS.GRADE_VIEW_TEACHING,
    PERMISSIONS.GRADE_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getStats
);

// 📄 Lấy danh sách điểm theo kỳ thi - Tất cả roles có quyền xem
router.get("/exam/:examId", 
  auth, 
  checkPermission([
    PERMISSIONS.GRADE_VIEW,
    PERMISSIONS.GRADE_VIEW_ALL,
    PERMISSIONS.GRADE_VIEW_DEPARTMENT,
    PERMISSIONS.GRADE_VIEW_HOMEROOM,
    PERMISSIONS.GRADE_VIEW_TEACHING,
    PERMISSIONS.GRADE_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getGradesByExam
);

// 🚀 Công bố điểm - Trưởng bộ môn / BGH / Admin
router.post("/exam/:examId/publish",
  auth,
  checkPermission([PERMISSIONS.EXAM_UPDATE], { checkContext: false }),
  ctrl.publishExamGrades
);

// 📊 Thống kê điểm cho Trưởng bộ môn (QLBM)
router.get("/department-head/stats",
  auth,
  checkPermission([PERMISSIONS.GRADE_VIEW_DEPARTMENT], { checkContext: false }),
  ctrl.getDepartmentHeadStats
);

// ➕ Nhập / Cập nhật điểm 1 học sinh - GVBM (môn mình dạy) hoặc Admin
router.post("/", 
  auth, 
  checkPermission([PERMISSIONS.EXAM_GRADE_ENTER, PERMISSIONS.EXAM_UPDATE], { checkContext: true }), 
  ctrl.addOrUpdateGrade
);

// 🔍 Lấy chi tiết 1 điểm - Tất cả roles có quyền xem
router.get("/:id", 
  auth, 
  checkPermission([
    PERMISSIONS.GRADE_VIEW,
    PERMISSIONS.GRADE_VIEW_ALL,
    PERMISSIONS.GRADE_VIEW_DEPARTMENT,
    PERMISSIONS.GRADE_VIEW_HOMEROOM,
    PERMISSIONS.GRADE_VIEW_TEACHING,
    PERMISSIONS.GRADE_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getGradeById
);

// ✏️ Cập nhật điểm theo ID - GVBM (môn mình dạy) hoặc Admin
router.put("/:id", 
  auth, 
  checkPermission([PERMISSIONS.EXAM_GRADE_ENTER, PERMISSIONS.EXAM_UPDATE], { checkContext: true }), 
  ctrl.updateGrade
);

// 🗑️ Xóa 1 bản ghi điểm - Chỉ Admin
router.delete("/:id", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.deleteGrade
);

module.exports = router;

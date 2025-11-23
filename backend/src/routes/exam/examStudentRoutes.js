const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/exam/examStudentController");
const auth = require("../../middlewares/authMiddleware");
const checkPermission = require("../../middlewares/checkPermission");
const { PERMISSIONS } = require("../../config/permissions");
const upload = require("../../middlewares/uploadMiddleware");

// ✅ Thêm học sinh vào kỳ thi - Chỉ Admin
router.post("/add", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.addStudentsToExam
);

// ✅ Thêm nhiều học sinh cùng lúc - Chỉ Admin
router.post("/add-multiple", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.addMultipleStudents
);

// ✅ Thêm tất cả học sinh theo khối - Chỉ Admin
router.post("/exam/:examId/add-all", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.addAllStudentsByGrades
);

// ✅ Lấy danh sách học sinh có thể thêm - Chỉ Admin
router.get("/exam/:examId/candidates", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.getCandidatesForExam
);

// ✅ Lấy danh sách học sinh dự thi - Tất cả roles có quyền xem
router.get("/exam/:examId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getStudentsByExam
);

// ✅ Lấy danh sách học sinh theo phòng thi - Tất cả roles có quyền xem
router.get("/room/:roomId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_ROOM_VIEW,
    PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
    PERMISSIONS.EXAM_ROOM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getStudentsByRoom
);

// ✅ Lấy chi tiết học sinh dự thi - Tất cả roles có quyền xem
router.get("/:id", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.getExamStudentById
);

// ✅ Cập nhật học sinh dự thi - Chỉ Admin
router.put("/:id", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.updateExamStudent
);

// ✅ Cập nhật nhiều học sinh - Chỉ Admin
router.put("/bulk-update", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.bulkUpdateExamStudents
);

// ✅ Xóa học sinh dự thi - Chỉ Admin
router.delete("/:id", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.deleteExamStudent
);

// ✅ Reset học sinh dự thi - Chỉ Admin
router.delete("/reset/:examId", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  ctrl.resetExamStudents
);

// ✅ Thống kê học sinh theo khối - Tất cả roles có quyền xem
router.get("/stats/:examId", 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ], { checkContext: false }),
  ctrl.countStudentsByGrade
);

// ✅ Import học sinh từ Excel - Chỉ Admin
router.post("/import", 
  auth, 
  checkPermission(PERMISSIONS.EXAM_UPDATE), 
  upload.single("file"), 
  ctrl.importStudentsFromExcel
);

// ✅ Xuất danh sách học sinh theo phòng nhóm - Tất cả roles có quyền xem
router.post("/export-by-fixed-rooms", 
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
  ctrl.exportStudentsByFixedRooms
);

module.exports = router;

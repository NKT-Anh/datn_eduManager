const express = require("express");
const router = express.Router();
const subjectController = require('../../controllers/subject/subjectController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// ✅ Danh sách môn học - Tất cả roles có quyền xem
router.get("/", 
  authMiddleware,
  checkPermission([
    PERMISSIONS.SUBJECT_VIEW,
    PERMISSIONS.SUBJECT_MANAGE_DEPARTMENT,
    PERMISSIONS.SUBJECT_VIEW_TEACHING
  ], { checkContext: false }),
  subjectController.getSubjects
);

// ✅ Lấy 1 môn học - Tất cả roles có quyền xem
router.get("/:id", 
  authMiddleware,
  checkPermission([
    PERMISSIONS.SUBJECT_VIEW,
    PERMISSIONS.SUBJECT_MANAGE_DEPARTMENT,
    PERMISSIONS.SUBJECT_VIEW_TEACHING
  ], { checkContext: false }),
  subjectController.getSubject
);

// ✅ Tạo môn học - Admin hoặc QLBM (môn bộ môn)
router.post("/",
  authMiddleware, 
  checkPermission([PERMISSIONS.SUBJECT_MANAGE, PERMISSIONS.SUBJECT_MANAGE_DEPARTMENT], { checkContext: true }), 
  subjectController.createSubject
);

// ✅ Cập nhật môn học - Admin hoặc QLBM (môn bộ môn)
router.put("/:id",
  authMiddleware, 
  checkPermission([PERMISSIONS.SUBJECT_MANAGE, PERMISSIONS.SUBJECT_MANAGE_DEPARTMENT], { checkContext: true }), 
  subjectController.updateSubject
);

// ✅ Xóa môn học - Chỉ Admin
router.delete("/:id",
  authMiddleware, 
  checkPermission(PERMISSIONS.SUBJECT_MANAGE), 
  subjectController.deleteSubject
);

// ✅ Cập nhật tính điểm trung bình - Admin hoặc QLBM
router.put('/:id/include-average', 
  authMiddleware, 
  checkPermission([PERMISSIONS.SUBJECT_MANAGE, PERMISSIONS.SUBJECT_MANAGE_DEPARTMENT], { checkContext: true }), 
  subjectController.updateIncludeInAverage
);

// ✅ Cập nhật thời lượng thi mặc định - Admin hoặc QLBM
router.patch("/:id/default-duration", 
  authMiddleware, 
  checkPermission([PERMISSIONS.SUBJECT_MANAGE, PERMISSIONS.SUBJECT_MANAGE_DEPARTMENT], { checkContext: true }), 
  subjectController.updateDefaultExamDuration
);

module.exports = router;

const express = require("express");
const router = express.Router();
const classController = require('../../controllers/class/classController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// ✅ Lấy danh sách các năm học có lớp - Tất cả roles có quyền xem
router.get('/years', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.CLASS_VIEW,
    PERMISSIONS.CLASS_VIEW_HOMEROOM,
    PERMISSIONS.CLASS_VIEW_TEACHING
  ], { checkContext: false }),
  classController.getAvailableYears
);

// ✅ Lấy danh sách tất cả lớp - Tất cả roles có quyền xem
// ✅ Có thể filter theo year query param, nếu không có thì trả về tất cả các lớp của tất cả các niên khóa
router.get('/', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.CLASS_VIEW,
    PERMISSIONS.CLASS_VIEW_HOMEROOM,
    PERMISSIONS.CLASS_VIEW_TEACHING
  ], { checkContext: false }),
  classController.getAllClasses
);

// ✅ Auto assign grade - Chỉ Admin
router.get('/auto-assign', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_UPDATE), 
  classController.autoAssignGrade
);

// ✅ Tạo lớp cho 1 năm học - Chỉ Admin
router.post('/setup-year', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_CREATE), 
  classController.setupYearClasses
);

// ✅ Lấy lớp theo năm - Tất cả roles có quyền xem
router.get("/group-by-year", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.CLASS_VIEW,
    PERMISSIONS.CLASS_VIEW_HOMEROOM,
    PERMISSIONS.CLASS_VIEW_TEACHING
  ], { checkContext: false }),
  classController.getGradesAndClassesByYear
);

// ✅ Tạo lớp mới - Chỉ Admin
router.post('/', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_CREATE), 
  classController.createClass
);

// ✅ Tham gia lớp - Chỉ Admin
router.post('/join-class', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_UPDATE), 
  classController.joinClass
);

// ✅ Cập nhật lớp theo ID - Chỉ Admin
router.put('/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_UPDATE), 
  classController.updateClass
);

// ✅ Xóa lớp theo ID - Chỉ Admin
router.delete('/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_DELETE), 
  classController.deleteClass
);

// ✅ Lấy lớp theo ID - Tất cả roles có quyền xem
router.get('/:id', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.CLASS_VIEW,
    PERMISSIONS.CLASS_VIEW_HOMEROOM,
    PERMISSIONS.CLASS_VIEW_TEACHING
  ], { checkContext: false }),
  classController.getClassById
);

// ✅ Gắn phòng cho lớp - Chỉ Admin
router.put('/:id/room', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_UPDATE), 
  classController.assignRoom
);

// ✅ Tự động gán phòng cho các lớp - Chỉ Admin
router.post('/auto-assign-rooms', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_UPDATE), 
  classController.autoAssignRooms
);

// ✅ Tự động gán giáo viên chủ nhiệm cho các lớp - Chỉ Admin
router.post('/auto-assign-homeroom-teachers', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_UPDATE), 
  classController.autoAssignHomeroomTeachers
);

module.exports = router;

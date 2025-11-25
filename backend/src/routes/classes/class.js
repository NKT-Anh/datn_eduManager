const express = require("express");
const router = express.Router();
const classController = require('../../controllers/class/classController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const { auditLog } = require('../../middlewares/auditLogMiddleware');

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
  auditLog({
    action: 'UPDATE',
    resource: 'CLASS',
    getResourceId: (req) => req.params.id,
    getResourceName: (req) => req.body?.className || null,
    getDescription: (req) => `Cập nhật lớp: ${req.body?.className || req.params.id}`,
  }),
  classController.updateClass
);

// ✅ Xóa lớp theo ID - Chỉ Admin
router.delete('/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.CLASS_DELETE),
  auditLog({
    action: 'DELETE',
    resource: 'CLASS',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `Xóa lớp: ${req.params.id}`,
  }),
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

// ✅ Lấy tất cả lớp chủ nhiệm của giáo viên qua các năm học - GVCN
router.get('/homeroom/classes', 
  authMiddleware, 
  checkPermission([PERMISSIONS.CLASS_VIEW_HOMEROOM, PERMISSIONS.CLASS_VIEW], { checkContext: false }), 
  classController.getAllHomeroomClasses
);

// ✅ Lấy lớp chủ nhiệm của giáo viên theo năm học (có thể truyền year query param) - GVCN
router.get('/homeroom/class', 
  authMiddleware, 
  checkPermission([PERMISSIONS.CLASS_VIEW_HOMEROOM, PERMISSIONS.CLASS_VIEW], { checkContext: false }), 
  classController.getHomeroomClass
);

// ✅ Lấy danh sách học sinh trong lớp chủ nhiệm - GVCN
router.get('/homeroom/students', 
  authMiddleware, 
  checkPermission([PERMISSIONS.STUDENT_VIEW_HOMEROOM, PERMISSIONS.STUDENT_VIEW], { checkContext: false }), 
  classController.getHomeroomClassStudents
);

// ✅ Lấy bảng điểm lớp chủ nhiệm (cả năm) - GVCN
router.get('/homeroom/grades', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_HOMEROOM, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  classController.getHomeroomClassGrades
);

module.exports = router;

const express = require('express');
const router = express.Router();
const teacherController = require('../../controllers/user/teacherController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// ✅ Cập nhật lịch rảnh - Giáo viên cập nhật của mình hoặc Admin
router.put('/:id/availability',
  authMiddleware, 
  checkPermission([PERMISSIONS.TEACHER_UPDATE, PERMISSIONS.TEACHER_VIEW], { checkContext: false }),
  teacherController.updateAvailability
);

// ✅ Lấy lịch rảnh - Tất cả roles có quyền xem
router.get('/:id/availability',
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHER_VIEW,
    PERMISSIONS.TEACHER_VIEW_DEPARTMENT
  ], { checkContext: false }),
  teacherController.getAvailability
);

// ✅ Danh sách giáo viên - Tất cả roles có quyền xem
router.get('/', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHER_VIEW,
    PERMISSIONS.TEACHER_VIEW_DEPARTMENT
  ], { checkContext: false }),
  teacherController.getAllTeachers
);

// ✅ Tạo giáo viên - Chỉ Admin
router.post('/', 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHER_CREATE), 
  teacherController.createTeacher
);

// ✅ Batch update maxClasses và weeklyLessons cho giáo viên theo môn học - Chỉ Admin
// ⚠️ PHẢI ĐẶT TRƯỚC TẤT CẢ route /:id để tránh match nhầm
// TODO: Function này chưa được implement, tạm thời comment lại
// router.put('/batch-update-limits', 
//   authMiddleware, 
//   checkPermission(PERMISSIONS.TEACHER_UPDATE, { checkContext: false }), 
//   teacherController.batchUpdateTeacherLimits
// );

// ✅ Lấy 1 giáo viên - Tất cả roles có quyền xem
router.get('/:id', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHER_VIEW,
    PERMISSIONS.TEACHER_VIEW_DEPARTMENT
  ], { checkContext: false }),
  teacherController.getTeacher
);

// ✅ Cập nhật giáo viên - Chỉ Admin
router.put('/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHER_UPDATE), 
  teacherController.updateTeacher
);

// ✅ Xóa giáo viên - Chỉ Admin
router.delete('/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHER_DELETE), 
  teacherController.deleteTeacher
);

// ✅ Cập nhật số lớp tối đa - Chỉ Admin
router.put('/:id/max-classes', 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHER_UPDATE), 
  teacherController.updateMaxClasses
);

// ✅ Cập nhật số lớp tối đa theo từng khối - Admin hoặc Trưởng bộ môn tổ của giáo viên
router.put('/:id/max-class-per-grade',
  authMiddleware,
  checkPermission([
    PERMISSIONS.TEACHER_UPDATE,
    PERMISSIONS.DEPARTMENT_MANAGE
  ], { checkContext: false }),
  teacherController.updateMaxClassPerGrade
);

// ✅ Lấy số lớp tối đa - Tất cả roles có quyền xem
router.get('/:id/max-classes', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHER_VIEW,
    PERMISSIONS.TEACHER_VIEW_DEPARTMENT
  ], { checkContext: false }),
  teacherController.getMaxClasses
);

// ✅ Lấy lớp đang chủ nhiệm và lớp đã chủ nhiệm của giáo viên - Tất cả roles có quyền xem
// TODO: Function này chưa được implement, tạm thời comment lại
// router.get('/:id/homeroom-classes', 
//   authMiddleware, 
//   checkPermission([
//     PERMISSIONS.TEACHER_VIEW,
//     PERMISSIONS.TEACHER_VIEW_DEPARTMENT
//   ], { checkContext: false }),
//   teacherController.getHomeroomClasses
// );

// ✅ Lấy ban giám hiệu - Public (không cần auth cho trang chủ)
// TODO: Function này chưa được implement, tạm thời comment lại
// router.get('/leadership', teacherController.getLeadership);

// ✅ Xuất danh sách giáo viên ra Excel - Chỉ Admin
// TODO: Function này chưa được implement, tạm thời comment lại
// router.get('/export/excel', 
//   authMiddleware, 
//   checkPermission(PERMISSIONS.TEACHER_VIEW, { checkContext: false }), 
//   teacherController.exportTeachersToExcel
// );

// ✅ Phân chia lại số lớp cho các giáo viên dạy cùng môn/khối - Chỉ Admin
// TODO: Function này chưa được implement, tạm thời comment lại
// router.post('/redistribute-classes', 
//   authMiddleware, 
//   checkPermission(PERMISSIONS.TEACHER_UPDATE), 
//   teacherController.redistributeClassesForSubjectGrade
// );

// ✅ Tự động tính lại maxClassPerGrade cho tất cả giáo viên - Chỉ Admin
// TODO: Function này chưa được implement, tạm thời comment lại
// router.post('/recalculate-max-class-per-grade', 
//   authMiddleware, 
//   checkPermission(PERMISSIONS.TEACHER_UPDATE), 
//   teacherController.recalculateAllMaxClassPerGrade
// );

// ✅ Kiểm tra tự động tình trạng giáo viên - Chỉ Admin
router.get('/check-status', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHER_VIEW,
    PERMISSIONS.TEACHER_VIEW_DEPARTMENT
  ], { checkContext: false }), 
  teacherController.checkTeacherStatus
);

module.exports = router;

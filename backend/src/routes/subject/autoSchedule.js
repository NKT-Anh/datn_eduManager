const express = require('express');
const router = express.Router();
const autoScheduleController = require('../../controllers/subject/autoScheduleController');

// ✅ Debug: Kiểm tra các hàm đã được export chưa
if (!autoScheduleController.validateBeforeGenerate) {
  console.error('❌ validateBeforeGenerate không tồn tại trong autoScheduleController');
}
if (!autoScheduleController.autoGenerateSchedule) {
  console.error('❌ autoGenerateSchedule không tồn tại trong autoScheduleController');
}
if (!autoScheduleController.generateScheduleForSingleClass) {
  console.error('❌ generateScheduleForSingleClass không tồn tại trong autoScheduleController');
}
if (!autoScheduleController.updateScheduleByDragDrop) {
  console.error('❌ updateScheduleByDragDrop không tồn tại trong autoScheduleController');
}
if (!autoScheduleController.createClassesForGrades) {
  console.error('❌ createClassesForGrades không tồn tại trong autoScheduleController');
}

// ✅ Kiểm tra điều kiện trước khi tạo lịch
router.post('/validate', autoScheduleController.validateBeforeGenerate);

// ✅ Tạo thời khóa biểu cho 1 lớp (để test) - Đặt TRƯỚC /generate để tránh match nhầm
router.post('/generate/:classId', autoScheduleController.generateScheduleForSingleClass);

// Tự động tạo thời khóa biểu cho nhiều lớp
router.post('/generate', autoScheduleController.autoGenerateSchedule);

// Cập nhật thời khóa biểu bằng kéo thả
router.put('/drag-drop', autoScheduleController.updateScheduleByDragDrop);

// Tạo lớp tự động cho các khối
router.post('/create-classes', autoScheduleController.createClassesForGrades);

module.exports = router;


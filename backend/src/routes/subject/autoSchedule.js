const express = require('express');
const router = express.Router();
const autoScheduleController = require('../../controllers/subject/autoScheduleController');

// ✅ Kiểm tra điều kiện trước khi tạo lịch
router.post('/validate', autoScheduleController.validateBeforeGenerate);

// Tự động tạo thời khóa biểu
router.post('/generate', autoScheduleController.autoGenerateSchedule);

// Cập nhật thời khóa biểu bằng kéo thả
router.put('/drag-drop', autoScheduleController.updateScheduleByDragDrop);

// Tạo lớp tự động cho các khối
router.post('/create-classes', autoScheduleController.createClassesForGrades);

module.exports = router;


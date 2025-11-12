const express = require("express");
const router = express.Router();
const classController = require('../../controllers/class/classController');
// const verifyToken = require('../../middlewares/verifyFirebaseToken');
// const checkRole = require('../../middlewares/checkRole');

// router.use(verifyToken,checkRole('admin','teacher'))

// const { joinClass } = require('../controllers/class/classController');
// Lấy danh sách tất cả lớp
router.get('/', classController.getAllClasses);

// Auto assign grade
router.get('/auto-assign', classController.autoAssignGrade);

// Tạo lớp cho 1 năm học
router.post('/setup-year', classController.setupYearClasses);
router.get("/group-by-year", classController.getGradesAndClassesByYear);
// Tạo lớp mới
router.post('/', classController.createClass);

// Tham gia lớp
router.post('/join-class', classController.joinClass);

// Cập nhật lớp theo ID
router.put('/:id', classController.updateClass);

// Xóa lớp theo ID
router.delete('/:id', classController.deleteClass);

// Lấy thông tin lớp theo ID
router.get('/:id', classController.getClassById);

module.exports = router;
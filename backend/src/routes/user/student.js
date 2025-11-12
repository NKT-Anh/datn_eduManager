const express = require('express');
const router = express.Router();
const studentController = require('../../controllers/user/studentController');
const authMiddleware = require('../../middlewares/authMiddleware'); 
// 📌 CRUD học sinh
router.get('/', studentController.getStudents);         // Danh sách học sinh
router.get('/:id', studentController.getStudentById);  // Lấy 1 học sinh
router.post('/', studentController.createStudent);     // Thêm học sinh
router.put('/:id', studentController.updateStudent);   // Cập nhật
router.delete('/:id', studentController.deleteStudent);// Xóa
router.post("/auto-assign", studentController.autoAssignToClasses);
 
module.exports = router; 
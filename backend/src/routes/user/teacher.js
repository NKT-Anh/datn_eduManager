const express = require('express');
const router = express.Router();
const teacherController = require('../../controllers/user/teacherController');
const verifyToken = require('../../middlewares/verifyFirebaseToken');
const checkRole = require('../../middlewares/checkRole');

// router.use(verifyToken,checkRole('teacher'))

// router.get('/teacher/dashboard', (req, res) => {
//   res.json({ message: `Xin chào thầy/cô ${req.currentUser.name}` });
// });
router.put('/:id/availability',teacherController.updateAvailability)
router.get('/:id/availability',teacherController.getAvailability)
router.get('/', teacherController.getAllTeachers);
router.get('/:id', teacherController.getTeacher);
router.post('/', teacherController.createTeacher);
router.put('/:id', teacherController.updateTeacher);
router.delete('/:id', teacherController.deleteTeacher);

router.put('/:id/max-classes', teacherController.updateMaxClasses);

// Lấy số lớp tối đa của giáo viên
router.get('/:id/max-classes', teacherController.getMaxClasses);
// router.get('/', teacherController.getAllTeachers);

// router.post('/', teacherController.createTeacher);
// router.put('/:id', teacherController.updateTeacher);
// router.delete('/:id', teacherController.deleteTeacher);

module.exports = router; 
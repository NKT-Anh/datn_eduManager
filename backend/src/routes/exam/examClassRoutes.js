// routes/exam/examClassRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/exam/examClassController');
const auth = require('../../middlewares/authMiddleware');

// CRUD cơ bản
router.post('/', auth, ctrl.createExamClass);
router.get('/', ctrl.getExamClasses);
router.get('/:id', ctrl.getExamClassById);
router.put('/:id', auth, ctrl.updateExamClass);
router.delete('/:id', auth, ctrl.deleteExamClass);

// 📊 Thống kê cơ bản (số học sinh theo khối)
router.get('/:examId/stats', ctrl.getExamClassStats);

// 📈 Thống kê nâng cao (học sinh theo lớp)
router.get('/:examId/class-detail', ctrl.getClassDetailStats);

module.exports = router;

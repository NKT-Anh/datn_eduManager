// routes/exam/examRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/exam/examController');
const auth = require('../../middlewares/authMiddleware');
const checkExamLocked = require('../../middlewares/checkExamLocked');
const checkExamArchived = require('../../middlewares/checkExamArchived');

// CRUD cơ bản
router.post('/', auth, ctrl.createExam);
router.get('/', ctrl.getExams);
router.get('/:id', ctrl.getExamById);
router.put('/:id', auth, checkExamLocked, checkExamArchived, ctrl.updateExam);
router.delete('/:id', auth, checkExamLocked, checkExamArchived, ctrl.deleteExam);
// Chức năng nâng cao
router.patch('/:id/lock', auth, ctrl.lockExam);
router.patch('/:id/archive', auth, ctrl.archiveExam);
router.post('/:id/clone', auth, ctrl.cloneExam);
router.get('/:id/stats', ctrl.getExamStats);
router.get('/summary/status', ctrl.getExamSummary);
router.get('/summary/year', ctrl.getYearlyStats);

module.exports = router;


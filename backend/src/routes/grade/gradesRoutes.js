const express = require('express');
const router = express.Router();

const gradeController = require('../../controllers/grade/gradesController');
const authMiddleware = require('../../middlewares/authMiddleware'); // ✅ middleware xác thực

// 🧾 Thêm hoặc cập nhật điểm (1 học sinh, 1 cột điểm)
router.post('/items', authMiddleware, gradeController.upsertGradeItem);

// 📊 Lấy bảng tổng hợp điểm của 1 lớp + môn học
router.get('/summary', authMiddleware, gradeController.getClassSubjectSummary);

// 🔁 Tính lại điểm tổng hợp cho 1 học sinh + môn học
router.post('/recompute', authMiddleware, gradeController.recomputeSummary);
router.post('/init', authMiddleware ,gradeController.initGradeTable) 
module.exports = router;

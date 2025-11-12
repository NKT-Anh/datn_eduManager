const express = require('express');
const router = express.Router();

const gradeController = require('../../controllers/grade/gradesController');
const authMiddleware = require('../../middlewares/authMiddleware'); // ✅ middleware xác thực
const checkGradeEntryPeriod = require('../../middlewares/checkGradeEntryPeriod'); // ✅ middleware kiểm tra thời gian nhập điểm

// 🧾 Thêm hoặc cập nhật điểm (1 học sinh, 1 cột điểm) - Cần kiểm tra thời gian
router.post('/items', authMiddleware, checkGradeEntryPeriod, gradeController.upsertGradeItem);

// 📊 Lấy bảng tổng hợp điểm của 1 lớp + môn học
router.get('/summary', authMiddleware, gradeController.getClassSubjectSummary);

// 🔁 Tính lại điểm tổng hợp cho 1 học sinh + môn học
router.post('/recompute', authMiddleware, gradeController.recomputeSummary);

// 💾 Lưu điểm nhiều học sinh cùng lúc - Cần kiểm tra thời gian
router.post('/save', authMiddleware, checkGradeEntryPeriod, gradeController.saveScores);

// 🎓 Học sinh xem điểm của bản thân
router.get('/student', authMiddleware, gradeController.getStudentGrades);

// 🏁 Khởi tạo bảng điểm cho tất cả lớp
router.post('/init', authMiddleware, gradeController.initGradeTable);

module.exports = router;

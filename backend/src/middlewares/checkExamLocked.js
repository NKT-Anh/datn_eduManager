// middlewares/checkExamLocked.js
const { Exam } = require('../models/exam/examIndex');

/**
 * 🧩 Middleware: Kiểm tra kỳ thi có bị khóa hay không.
 * Nếu kỳ thi đã bị khóa (status === "locked"), chặn thao tác PUT / DELETE.
 */
module.exports = async function checkExamLocked(req, res, next) {
  try {
    const examId = req.params.id;
    if (!examId) return res.status(400).json({ error: 'Thiếu ID kỳ thi.' });

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy kỳ thi.' });

    // Nếu đã bị khóa → không cho phép sửa / xóa
    if (exam.status === 'locked') {
      return res.status(403).json({ 
        error: '⛔ Kỳ thi này đã bị khóa. Bạn không thể chỉnh sửa hoặc xóa.' 
      });
    }

    // Cho phép đi tiếp
    next();
  } catch (err) {
    console.error('❌ Lỗi trong checkExamLocked:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi kiểm tra trạng thái kỳ thi.' });
  }
};

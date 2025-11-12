// middlewares/checkExamArchived.js
const { Exam } = require('../models/exam/examIndex');

/**
 * 🧩 Middleware: Chặn thao tác chỉnh sửa hoặc xóa
 * nếu kỳ thi đã được lưu trữ (isArchived = true).
 */
module.exports = async function checkExamArchived(req, res, next) {
  try {
    const examId = req.params.id;
    if (!examId) return res.status(400).json({ error: 'Thiếu ID kỳ thi.' });

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy kỳ thi.' });

    if (exam.isArchived) {
      return res.status(403).json({
        error: '📦 Kỳ thi này đã được lưu trữ. Không thể chỉnh sửa hoặc xóa.'
      });
    }

    next();
  } catch (err) {
    console.error('❌ Lỗi trong checkExamArchived:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi kiểm tra kỳ thi lưu trữ.' });
  }
};

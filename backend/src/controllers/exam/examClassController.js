// controllers/exam/examClassController.js
const { ExamClass, ExamStudent } = require('../../models/exam/examIndex');
const mongoose = require('mongoose');

/* =========================================================
   🟢 TẠO KHỐI THI (ExamClass)
========================================================= */
exports.createExamClass = async (req, res) => {
  try {
    const { exam, grade, classes } = req.body;
    if (!exam || !grade || !classes?.length) {
      return res.status(400).json({ error: 'Thiếu dữ liệu bắt buộc (exam, grade, classes).' });
    }

    // Kiểm tra trùng khối trong kỳ thi
    const exists = await ExamClass.findOne({ exam, grade });
    if (exists) return res.status(400).json({ error: 'Khối này đã tồn tại trong kỳ thi.' });

    const newClass = await ExamClass.create(req.body);
    res.status(201).json({ message: '✅ Tạo khối thi thành công.', data: newClass });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🟡 LẤY DANH SÁCH KHỐI THI (theo kỳ thi hoặc toàn bộ)
========================================================= */
exports.getExamClasses = async (req, res) => {
  try {
    const { examId, page = 1, limit = 10, grade } = req.query;
    const filter = {};
    if (examId) filter.exam = examId;
    if (grade) filter.grade = grade;

    const data = await ExamClass.find(filter)
      .populate('exam', 'name year semester')
      .sort({ grade: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await ExamClass.countDocuments(filter);

    res.json({
      total,
      totalPages: Math.ceil(total / limit),
      page: parseInt(page),
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🔍 LẤY CHI TIẾT KHỐI THI THEO ID
========================================================= */
exports.getExamClassById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: 'ID không hợp lệ.' });

    const item = await ExamClass.findById(id)
      .populate('exam', 'name year semester')
      .lean();

    if (!item) return res.status(404).json({ error: 'Không tìm thấy khối thi.' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT KHỐI THI
========================================================= */
exports.updateExamClass = async (req, res) => {
  try {
    const updated = await ExamClass.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy khối thi để cập nhật.' });
    res.json({ message: '✅ Cập nhật thành công.', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ XÓA KHỐI THI
========================================================= */
exports.deleteExamClass = async (req, res) => {
  try {
    const deleted = await ExamClass.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Không tìm thấy khối thi để xóa.' });
    res.json({ message: '🗑️ Đã xóa khối thi khỏi kỳ thi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📊 THỐNG KÊ CƠ BẢN: SỐ HỌC SINH THEO KHỐI
========================================================= */
exports.getExamClassStats = async (req, res) => {
  try {
    const examId = req.params.examId;
    if (!mongoose.Types.ObjectId.isValid(examId))
      return res.status(400).json({ error: 'ID kỳ thi không hợp lệ.' });

    const stats = await ExamStudent.aggregate([
      { $match: { exam: new mongoose.Types.ObjectId(examId) } },
      { $group: { _id: '$grade', totalStudents: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📈 THỐNG KÊ NÂNG CAO: HỌC SINH THEO LỚP
========================================================= */
exports.getClassDetailStats = async (req, res) => {
  try {
    const examId = req.params.examId;
    const stats = await ExamStudent.aggregate([
      { $match: { exam: new mongoose.Types.ObjectId(examId) } },
      { $group: { _id: '$className', totalStudents: { $sum: 1 } } },
      { $sort: { totalStudents: -1 } },
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

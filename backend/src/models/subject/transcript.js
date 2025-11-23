const mongoose = require('mongoose');

const transcriptSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  semester: { type: String, enum: ['HK1', 'HK2'], required: true },

  // Có thể chi tiết hóa thành nhiều cột điểm
  score15p: { type: Number, min: 0, max: 10 },   // kiểm tra 15 phút
  score1h: { type: Number, min: 0, max: 10 },    // kiểm tra 1 tiết
  scoreFinal: { type: Number, min: 0, max: 10 }, // kiểm tra học kỳ

  average: { type: Number, min: 0, max: 10 } // điểm trung bình môn (auto tính)
}, { timestamps: true });

const Transcript = mongoose.model('Transcript', transcriptSchema);
module.exports = Transcript;

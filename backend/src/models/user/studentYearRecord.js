// models/studentYearRecord.js
const mongoose = require("mongoose");

const studentYearRecordSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  year: { type: String, required: true }, // "2025-2026"
  semester: { type: String, enum: ["HK1", "HK2", "CN"], default: "CN" }, // CN = cả năm

  gpa: { type: Number, default: 0 }, // điểm TB học kỳ hoặc cả năm
  conduct: { type: String, enum: ["Tốt", "Khá", "Trung bình", "Yếu"], default: "Tốt" },
  academicLevel: { type: String, enum: ["Giỏi", "Khá", "Trung bình", "Yếu"], default: null }, // Học lực
  rank: { type: Number, default: 0 },

  totalAbsent: { type: Number, default: 0 }, // số buổi nghỉ
  totalLate: { type: Number, default: 0 },
  note: { type: String },

  // Bạn có thể thêm thống kê hoặc ID của giáo viên chủ nhiệm xác nhận
  homeroomTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
}, { timestamps: true });

studentYearRecordSchema.index({ studentId: 1, year: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model("StudentYearRecord", studentYearRecordSchema);

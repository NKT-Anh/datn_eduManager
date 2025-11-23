const mongoose = require('mongoose');

/**
 * Schema điểm danh học sinh
 * - Giáo viên điểm danh theo từng tiết học
 * - Status: present (Có mặt), absent (Vắng không phép), excused (Vắng có phép), late (Muộn)
 * - Có thể ghi chú lý do vắng mặt
 */
const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  date: { type: Date, required: true }, // Ngày điểm danh
  period: { type: Number, required: true }, // Tiết học (1-10)
  status: { 
    type: String, 
    enum: ['present', 'absent', 'excused', 'late'], 
    required: true,
    default: 'present'
  },
  notes: { type: String }, // Ghi chú lý do (ví dụ: "Ốm", "Có việc riêng")
  schoolYear: { type: String, required: true }, // Năm học, ví dụ: "2024-2025"
  semester: { type: String, enum: ['1', '2'], required: true }, // Học kỳ
}, { timestamps: true });

// Index để truy vấn nhanh
attendanceSchema.index({ studentId: 1, date: 1, period: 1, subjectId: 1 }, { unique: true });
attendanceSchema.index({ classId: 1, date: 1 });
attendanceSchema.index({ teacherId: 1, date: 1 });
attendanceSchema.index({ schoolYear: 1, semester: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;

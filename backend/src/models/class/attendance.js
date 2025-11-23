const mongoose = require('mongoose');

/**
 * Schema điểm danh học sinh
 * - GVCN điểm danh theo buổi học (sáng/chiều) cho toàn bộ học sinh lớp chủ nhiệm
 * - Status: present (Có mặt), absent (Vắng không phép), excused (Vắng có phép), late (Muộn)
 * - Có thể ghi chú lý do vắng mặt
 */
const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  date: { type: Date, required: true }, // Ngày điểm danh
  session: { 
    type: String, 
    enum: ['morning', 'afternoon'], 
    required: true 
  }, // Buổi học: sáng hoặc chiều
  // period và subjectId đã deprecated - chỉ dùng cho backward compatible với dữ liệu cũ
  period: { type: Number }, // Deprecated: Không còn sử dụng, chỉ để backward compatible
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }, // Deprecated: Không còn sử dụng, chỉ để backward compatible
  status: { 
    type: String, 
    enum: ['present', 'absent', 'excused', 'late'], 
    required: true,
    default: 'present'
  },
  notes: { type: String }, // Ghi chú lý do (ví dụ: "Ốm", "Có việc riêng")
  schoolYear: { type: String, required: true }, // Năm học, ví dụ: "2024-2025"
  semester: { type: String, enum: ['1', '2'], required: true }, // Học kỳ
  // ✅ Lịch sử chỉnh sửa (audit log) - để BGH/Admin giám sát
  editHistory: [{
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true }, // Người chỉnh sửa
    editedAt: { type: Date, default: Date.now }, // Thời gian chỉnh sửa
    reason: { type: String }, // Lý do chỉnh sửa (bắt buộc khi chỉnh sửa điểm danh cũ)
    oldStatus: { type: String }, // Trạng thái cũ
    newStatus: { type: String }, // Trạng thái mới
    oldNotes: { type: String }, // Ghi chú cũ
    newNotes: { type: String }, // Ghi chú mới
  }],
}, { timestamps: true });

// Index để truy vấn nhanh
attendanceSchema.index({ studentId: 1, date: 1, session: 1 }, { unique: true }); // GVCN điểm danh theo buổi
attendanceSchema.index({ studentId: 1, date: 1, period: 1, subjectId: 1 }); // Backward compatible
attendanceSchema.index({ classId: 1, date: 1, session: 1 });
attendanceSchema.index({ teacherId: 1, date: 1 });
attendanceSchema.index({ schoolYear: 1, semester: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;

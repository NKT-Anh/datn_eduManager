const mongoose = require('mongoose');

const teachingAssignmentSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher',default: null },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null},
  semester: { type: String, required: true },
  year: { type: String, required: true }, // Năm học, ví dụ: "2023-2024"
  // ✅ Khóa danh sách phân công giảng dạy
  isLocked: { type: Boolean, default: false }, // Trạng thái khóa
  lockedAt: { type: Date, default: null }, // Thời gian khóa
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null }, // Người khóa
  unlockAt: { type: Date, default: null }, // Thời gian mở khóa (nếu có lịch tự động)
  unlockBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null }, // Người mở khóa
}, { timestamps: true });

teachingAssignmentSchema.index(
  { teacherId: 1, subjectId: 1, classId: 1, year: 1, semester: 1 },
  { unique: true }

)
const TeachingAssignment = mongoose.model('TeachingAssignment', teachingAssignmentSchema);
module.exports = TeachingAssignment;


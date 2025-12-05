const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const examStudentSchema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
  grade: { type: String, required: true },
  // 🏫 Phòng thi cố định (FixedExamRoom) - ổn định suốt kỳ thi
  room: { type: Schema.Types.ObjectId, ref: "FixedExamRoom", default: null },
  sbd: { type: String, required: true, trim: true },
  subjects: [
    {
      subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
      examSchedule: { type: Schema.Types.ObjectId, ref: "ExamSchedule" }, // 🔹 thêm
      status: {
        type: String,
        enum: ["registered", "completed", "absent"],
        default: "registered",
      },
      score: { type: Number, default: null },
    },
  ],
  status: {
    type: String,
    enum: ["active", "absent", "excluded"],
    default: "active",
  },
  note: String,
}, { timestamps: true });

// ✅ Unique index: mỗi học sinh chỉ có thể tham gia 1 lần trong 1 kỳ thi
// Sử dụng sparse: true để tránh lỗi khi có document với exam hoặc student là null
examStudentSchema.index({ exam: 1, student: 1 }, { unique: true, sparse: true });
// ✅ Unique index: SBD phải duy nhất trong 1 kỳ thi
examStudentSchema.index({ exam: 1, sbd: 1 }, { unique: true, sparse: true });
// ✅ Index để tìm kiếm theo phòng thi
examStudentSchema.index({ room: 1 });
// ✅ Index để tối ưu cập nhật/truy vấn theo môn trong mảng subjects
examStudentSchema.index({ exam: 1, grade: 1, "subjects.subject": 1 });

module.exports = mongoose.model("ExamStudent", examStudentSchema);


const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const examGradeSchema = new Schema(
  {
    // 🔗 Kỳ thi (bắt buộc)
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },

    // 🔗 Lịch thi (ExamSchedule)
    examSchedule: { type: Schema.Types.ObjectId, ref: "ExamSchedule" },

    // 🔗 Học sinh
    student: { type: Schema.Types.ObjectId, ref: "ExamStudent", required: true },

    // 🔗 Lớp học (để thống kê nhanh)
    class: { type: Schema.Types.ObjectId, ref: "Class" },

    // 🔢 Khối (VD: 10, 11, 12)
    grade: { type: Number },

    // 🔗 Môn thi
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },

    // 🎯 Điểm (0–10)
    gradeValue: { type: Number, min: 0, max: 10, default: null },

    // 👩‍🏫 Giáo viên chấm thi
    teacher: { type: Schema.Types.ObjectId, ref: "Teacher" },

    // ✅ Người duyệt (thường là Admin)
    verifiedBy: { type: Schema.Types.ObjectId, ref: "Admin" },

    // 🏫 Phòng thi (liên kết với ExamRoom)
    room: { type: Schema.Types.ObjectId, ref: "ExamRoom" },

    // 🗒️ Ghi chú thêm
    note: { type: String, trim: true },

    // 🔒 Trạng thái khóa điểm
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* =========================================================
   ⚡ Index để tối ưu truy vấn và đảm bảo tính duy nhất
========================================================= */
examGradeSchema.index({ exam: 1, student: 1, subject: 1 }, { unique: true }); // 1 HS - 1 môn - 1 kỳ thi
examGradeSchema.index({ exam: 1, subject: 1 });
examGradeSchema.index({ teacher: 1 });
examGradeSchema.index({ room: 1 });
examGradeSchema.index({ grade: 1 });

module.exports = mongoose.model("ExamGrade", examGradeSchema);

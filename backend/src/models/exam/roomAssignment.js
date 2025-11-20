// models/exam/roomAssignment.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 🪑 RoomAssignment — học sinh trong 1 phòng thi cụ thể (1 môn)
 * Dùng để xác định STT & SBD trong từng môn, từng phòng.
 */
const roomAssignmentSchema = new Schema(
  {
    // 🔗 Kỳ thi
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },

    // 🔗 Lịch thi (môn, ngày, ca)
    schedule: { type: Schema.Types.ObjectId, ref: "ExamSchedule", required: true },

    // 🔗 Môn thi (cache)
    subject: { type: Schema.Types.ObjectId, ref: "Subject" },

    // 🔗 Phòng thi
    examRoom: { type: Schema.Types.ObjectId, ref: "ExamRoom", required: true },

    // 🔗 Học sinh (ExamStudent)
    examStudent: { type: Schema.Types.ObjectId, ref: "ExamStudent", required: true },

    // 🔢 Số thứ tự trong phòng (1 → 24)
    seatNumber: { type: Number, required: true },

    // 🔖 Số báo danh (cache)
    sbd: { type: String, required: true },

    // 👣 Trạng thái (VD: vắng, có mặt, bị đình chỉ)
    status: {
      type: String,
      enum: ["present", "absent", "excluded"],
      default: "present",
    },

    note: { type: String },
  },
  { timestamps: true }
);


// ❌ Không cho trùng STT trong cùng phòng
roomAssignmentSchema.index({ examRoom: 1, seatNumber: 1 }, { unique: true, sparse: true });

// ❌ Mỗi học sinh chỉ có 1 chỗ trong 1 môn (schedule)
roomAssignmentSchema.index({ schedule: 1, examStudent: 1 }, { unique: true, sparse: true });

// 🔍 Truy vấn nhanh theo phòng, môn, kỳ thi
roomAssignmentSchema.index({ schedule: 1, examRoom: 1 });
roomAssignmentSchema.index({ exam: 1 });

module.exports = mongoose.model("RoomAssignment", roomAssignmentSchema);

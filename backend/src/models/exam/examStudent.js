const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const examStudentSchema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
  grade: { type: Number, required: true },
  room: { type: Schema.Types.ObjectId, ref: "ExamRoom", default: null }, // 🔹 thêm
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

examStudentSchema.index({ exam: 1, student: 1 }, { unique: true });
examStudentSchema.index({ exam: 1, sbd: 1 }, { unique: true });
examStudentSchema.index({ room: 1 });


const mongoose = require("mongoose");

const PeriodSchema = new mongoose.Schema({
  period: { type: Number, required: true }, // tiết số
  // subject: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "Subject",
  //   default: null, // cho phép trống nếu tiết nghỉ
  // },
  // teacher: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "Teacher",
  //   default: null,
  // },
  subject: { type: String, default: ""  },  // Lưu tên môn học
  teacher: { type: String, default: "" },  // Lưu tên giáo viên
});

const TimetableSchema = new mongoose.Schema({
  day: { type: String, required: true }, // mon, tue, wed...
  periods: [PeriodSchema],
});

const ScheduleSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    className: { type: String },
    year: { type: String, required: true }, // "2024-2025"
    semester: { type: String, required: true }, // "1" hoặc "2"
    timetable: [TimetableSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Schedule", ScheduleSchema);

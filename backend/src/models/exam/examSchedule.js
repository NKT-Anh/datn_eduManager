const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const examScheduleSchema = new Schema(
  {
    // 🔗 Liên kết với kỳ thi
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },

    // 🏫 Khối học (VD: '10', '11', '12')
    grade: { type: String, required: true },

    // 📚 Môn thi
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },

    // 🗓️ Ngày & thời gian thi
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // "HH:mm"
    endTime: { type: String },
    duration: { type: Number, default: 90 }, // phút

    // 📖 Loại bài thi
    examType: {
      type: String,
      enum: ["midterm", "final"],
      default: "midterm",
    },

    // 🧮 Thống kê nhanh
    roomCount: { type: Number, default: 0 }, // số phòng thi thuộc lịch này
    studentsCount: { type: Number, default: 0 }, // tổng học sinh

    // 📋 Trạng thái
    status: {
      type: String,
      enum: ["draft", "confirmed", "completed"],
      default: "draft",
    },
    invigilatorCount: { type: Number, default: 0 },


    // 🗒️ Ghi chú thêm
    notes: { type: String },
    
    // ✅ Soft delete
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/**
 * 🕒 Middleware:
 * Tự động tính giờ kết thúc dựa trên startTime + duration nếu chưa có endTime.
 */
// Thêm middleware để tự động tính endTime khi insertMany
examScheduleSchema.pre("insertMany", function (next, docs) {
  docs.forEach(doc => {
    if (!doc.endTime && doc.startTime && doc.duration) {
      const [h, m] = doc.startTime.split(":").map(Number);
      const base = new Date(doc.date);
      base.setHours(h, m, 0, 0);
      const end = new Date(base.getTime() + doc.duration * 60000);
      doc.endTime = `${end.getHours()}:${end.getMinutes().toString().padStart(2, "0")}`;
    }
  });
  next();
});

/**
 * ⚡ Index để tăng tốc truy vấn thống kê và tìm kiếm
 */
examScheduleSchema.index({ exam: 1, grade: 1, subject: 1 });
examScheduleSchema.index({ date: 1 });
examScheduleSchema.index({ status: 1 });

module.exports = mongoose.model("ExamSchedule", examScheduleSchema);

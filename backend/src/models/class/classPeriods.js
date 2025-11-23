const mongoose = require("mongoose");

/**
 * ClassPeriods - Phân bổ số tiết theo lớp
 * Lưu số tiết/tuần cho từng môn học và hoạt động trong từng lớp cụ thể
 */
const ClassPeriodsSchema = new mongoose.Schema(
  {
    // Năm học
    year: {
      type: String,
      required: true,
      index: true,
    },

    // Học kỳ
    semester: {
      type: String,
      enum: ["1", "2"],
      required: true,
      index: true,
    },

    // Khối (10, 11, 12)
    grade: {
      type: String,
      enum: ["10", "11", "12"],
      required: true,
      index: true,
    },

    // Lớp học
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },

    // Số tiết theo môn học: { subjectId: periodsPerWeek }
    subjectPeriods: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },

    // Số tiết theo hoạt động: { activityId: periodsPerWeek }
    activityPeriods: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Compound index để đảm bảo unique cho mỗi lớp trong năm học + học kỳ
ClassPeriodsSchema.index({ year: 1, semester: 1, grade: 1, classId: 1 }, { unique: true });

// ✅ Index để query nhanh
ClassPeriodsSchema.index({ year: 1, semester: 1, grade: 1 });
ClassPeriodsSchema.index({ classId: 1 });

const ClassPeriods = mongoose.model("ClassPeriods", ClassPeriodsSchema);

module.exports = ClassPeriods;


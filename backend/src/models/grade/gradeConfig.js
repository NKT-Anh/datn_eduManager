// models/grade/GradeConfig.js
const mongoose = require('mongoose');

const GradeConfigSchema = new mongoose.Schema(
  {
    schoolYear: { type: String, required: true },
    semester: { type: String, enum: ['1', '2'], required: true },
    weights: {
      oral: { type: Number, default: 1 },
      quiz15: { type: Number, default: 1 },
      quiz45: { type: Number, default: 2 },
      midterm: { type: Number, default: 2 },
      final: { type: Number, default: 3 },
    },
    // ✅ Số cột điểm cho mỗi component (ví dụ: 3 cột miệng, 3 cột 15p)
    columnCounts: {
      oral: { type: Number, default: 3, min: 1, max: 10 },
      quiz15: { type: Number, default: 3, min: 1, max: 10 },
      quiz45: { type: Number, default: 1, min: 1, max: 10 },
      midterm: { type: Number, default: 1, min: 1, max: 10 },
      final: { type: Number, default: 1, min: 1, max: 10 },
    },
    rounding: { type: String, enum: ['half-up', 'none'], default: 'half-up' },
    // ✅ Cấu hình xếp loại học tập
    classification: {
      excellent: {
        minAverage: { type: Number, default: 8.0 }, // Điểm TB năm tối thiểu
        minSubjectScore: { type: Number, default: 6.5 }, // Điểm TB từng môn tối thiểu
      },
      good: {
        minAverage: { type: Number, default: 6.5 }, // Điểm TB năm tối thiểu
        minSubjectScore: { type: Number, default: 5.0 }, // Điểm TB từng môn tối thiểu
      },
      average: {
        minAverage: { type: Number, default: 5.0 }, // Điểm TB năm tối thiểu
        minSubjectScore: { type: Number, default: 3.5 }, // Điểm TB từng môn tối thiểu (> 3.5)
      },
      weak: {
        maxAverage: { type: Number, default: 5.0 }, // Điểm TB năm tối đa (dưới 5.0)
        maxSubjectScore: { type: Number, default: 3.5 }, // Điểm TB từng môn tối đa (< 3.5)
      },
    },
    // ✅ Môn bắt buộc phải đạt điểm tối thiểu
    requiredSubjects: [{
      subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
      minScore: { type: Number, required: true, min: 0, max: 10 },
      groupId: { type: String }, // Nhóm các môn (ví dụ: "group1" cho Toán và Văn)
      requireAll: { type: Boolean, default: false }, // true: tất cả môn trong nhóm phải đạt, false: chỉ cần 1 trong nhóm
      classificationType: { type: String, enum: ['excellent', 'good', 'average', 'weak'], default: 'excellent' }, // Loại xếp loại áp dụng điều kiện này
    }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

GradeConfigSchema.index({ schoolYear: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('GradeConfig', GradeConfigSchema);

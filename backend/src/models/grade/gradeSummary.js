const mongoose = require('mongoose');

  const AveragesSchema = new mongoose.Schema(
    {
      oral: { type: Number },
      quiz15: { type: Number },
      quiz45: { type: Number },
      midterm: { type: Number },
      final: { type: Number },
    },
    { _id: false }
  );

  const GradeSummarySchema = new mongoose.Schema(
    {
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
      subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
      classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
      schoolYear: { type: String, required: true },
      semester: { type: String, enum: ['1', '2'], required: true },

      averages: { type: AveragesSchema, default: {} },
      average: { type: Number }, // điểm TB kỳ
      computedAt: { type: Date, default: Date.now },
      version: { type: String }, // optional nếu muốn tracking cấu hình tính
    },
    { timestamps: true }
  );

  GradeSummarySchema.index({ classId: 1, subjectId: 1, schoolYear: 1, semester: 1 });
  GradeSummarySchema.index({ studentId: 1, subjectId: 1, schoolYear: 1, semester: 1 }, { unique: true });

  module.exports = mongoose.model('GradeSummary', GradeSummarySchema);
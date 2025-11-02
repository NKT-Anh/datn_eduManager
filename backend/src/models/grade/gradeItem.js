const mongoose = require('mongoose');

  const GradeItemSchema = new mongoose.Schema(
    {
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
      subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
      classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: false },
      schoolYear: { type: String, required: true }, // ví dụ: "2024-2025"
      semester: { type: String, enum: ['1', '2'], required: true },

      component: {
        type: String,
        enum: ['oral', 'quiz15', 'quiz45', 'midterm', 'final'],
        required: true,
      },
      score: { type: Number, min: 0, max: 10, required: true },
      weight: { type: Number }, // optional nếu muốn override trọng số chuẩn
      attempt: { type: Number, default: 1 }, // lần thứ mấy cho cùng component

      teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
      date: { type: Date, default: Date.now },
      notes: { type: String },
    },
    { timestamps: true }
  );

  // Index hỗ trợ truy vấn bảng điểm nhanh
  GradeItemSchema.index({ classId: 1, subjectId: 1, schoolYear: 1, semester: 1 });
  GradeItemSchema.index({ studentId: 1, subjectId: 1, schoolYear: 1, semester: 1 });
  GradeItemSchema.index({ teacherId: 1, date: -1 });

  module.exports = mongoose.model('GradeItem', GradeItemSchema);
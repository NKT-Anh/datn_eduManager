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
    rounding: { type: String, enum: ['half-up', 'none'], default: 'half-up' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

GradeConfigSchema.index({ schoolYear: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('GradeConfig', GradeConfigSchema);

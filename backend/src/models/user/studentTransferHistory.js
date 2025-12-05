const mongoose = require('mongoose');

const performedBySchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    role: { type: String },
    email: { type: String },
    name: { type: String },
    uid: { type: String },
  },
  { _id: false }
);

const metadataSchema = new mongoose.Schema(
  {
    keepOldYearRecords: { type: Boolean, default: true },
  },
  { _id: false }
);

const studentTransferHistorySchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    fromClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    fromClassName: { type: String, default: null },
    fromGrade: { type: String, default: null },
    fromYear: { type: String, default: null },
    toClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    toClassName: { type: String, default: null },
    toGrade: { type: String, default: null },
    toYear: { type: String, required: true },
    effectiveDate: { type: Date, default: Date.now },
    reason: { type: String, default: null },
    performedBy: { type: performedBySchema, default: undefined },
    metadata: { type: metadataSchema, default: undefined },
  },
  { timestamps: true }
);

studentTransferHistorySchema.index({ studentId: 1, createdAt: -1 });
studentTransferHistorySchema.index({ studentId: 1, toYear: 1 });

module.exports = mongoose.model('StudentTransferHistory', studentTransferHistorySchema);

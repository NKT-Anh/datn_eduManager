const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const examClassSchema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  grade: { type: Number, required: true, enum: [10, 11, 12] },
  classes: [{ type: String, required: true }],           // ['10A1', '10A2']
  classRefs: [{ type: Schema.Types.ObjectId, ref: 'Class' }],
  totalStudents: { type: Number, default: 0 },
  examSubjects: [{ type: String }],                      // các môn thi của khối
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

examClassSchema.index({ exam: 1, grade: 1 });
examClassSchema.index({ exam: 1, classes: 1 });
examClassSchema.index({ status: 1 });

module.exports = mongoose.model('ExamClass', examClassSchema);

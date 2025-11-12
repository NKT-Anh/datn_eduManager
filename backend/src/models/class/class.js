const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  classCode: { type: String, required: true, unique: true },
  className: { type: String, required: true },
  year: { type: String, required: true }, // VD: "2025-2026"
  grade: { type: String, enum: ['10', '11', '12'], required: true },
  capacity: { type: Number, default: 45 },
  currentSize: { type: Number, default: 0 },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],

    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },

});
classSchema.pre("save", function (next) {
  if (this.students) {
    this.currentSize = this.students.length;
  }
  next();
});
classSchema.index({ classCode: 1 });
classSchema.index({ grade: 1, year: 1 });
const Class = mongoose.model('Class', classSchema);

module.exports = Class; 
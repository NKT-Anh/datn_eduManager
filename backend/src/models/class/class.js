const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  classCode: { type: String, required: true, unique: true },
  className: { type: String, required: true },
  year: { type: String, required: true },
  grade: { type: String, enum: ['10', '11', '12'], required: true },
  capacity: { type: Number, default: 45 },
  currentSize: { type: Number, default: 0 },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const Class = mongoose.model('Class', classSchema);

module.exports = Class; 
const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Toán, Văn, Anh
  code: { type: String, unique: true },   // MATH10, LIT11
  grades: [{ type: String, enum: ['10', '11', '12'], required: true }], // mảng khối
  description: { type: String },
  includeInAverage: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Subject = mongoose.model('Subject', subjectSchema);
module.exports = Subject;

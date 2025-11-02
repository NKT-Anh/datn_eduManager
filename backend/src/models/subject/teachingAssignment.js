const mongoose = require('mongoose');

const teachingAssignmentSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher',default: null },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null},
  semester: { type: String, required: true },
  year: { type: String, required: true } // Năm học, ví dụ: "2023-2024"
}, { timestamps: true });

teachingAssignmentSchema.index(
  { teacherId: 1, subjectId: 1, classId: 1, year: 1, semester: 1 },
  { unique: true }

)
const TeachingAssignment = mongoose.model('TeachingAssignment', teachingAssignmentSchema);
module.exports = TeachingAssignment;
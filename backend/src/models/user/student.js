const mongoose = require('mongoose');
const User = require('./user');

const studentSchema = new mongoose.Schema({
  studentCode: { type: String, unique: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null,required: false  },

  admissionYear: { type: Number },
  
  grade: { type: String, enum: ['10', '11', '12'] },
  // entranceScore: { type: Number },
  // gpa: { type: Number, min: 0, max: 10, default: 0 },
  parentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Parent', default: [] }],

  status: { type: String, enum: ['active', 'inactive'], default: 'active' },

});

const Student = User.discriminator('Student', studentSchema);
module.exports = Student; 
const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({
  name: { type: String, required: false },
  phone: { type: String, required: false },
  occupation: { type: String },
  relation: { type: String, enum: ['father', 'mother', 'guardian'], default: null },
//   studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' } // liên kết ngược nếu cần
}, { timestamps: true });

const Parent = mongoose.model('Parent', parentSchema);

module.exports = Parent;

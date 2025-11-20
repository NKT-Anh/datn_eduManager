const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['discipline', 'academic', 'safety', 'other'], 
    default: 'other' 
  },
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'], 
    default: 'medium' 
  },
  status: { 
    type: String, 
    enum: ['reported', 'investigating', 'resolved', 'closed'], 
    default: 'reported' 
  },
  reportedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  classId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class' 
  },
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student' 
  },
  handledBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Teacher' 
  },
  resolution: { type: String },
  resolutionDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

incidentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Incident = mongoose.model('Incident', incidentSchema);
module.exports = Incident;

















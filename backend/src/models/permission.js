const mongoose = require('mongoose');

/**
 * Model lưu quyền nghiệp vụ theo năm học cho từng role
 * Mỗi role có thể có các quyền khác nhau trong từng năm học
 */
const permissionSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['admin', 'teacher', 'student'],
    index: true
  },
  schoolYear: {
    type: String,
    required: true,
    index: true
  },
  permissions: {
    type: [String],
    default: [],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    default: null
  }
}, {
  timestamps: true
});

// ✅ Index để tìm nhanh permission theo role và năm học
permissionSchema.index({ role: 1, schoolYear: 1 }, { unique: true });

// ✅ Index để tìm tất cả permissions của một năm học
permissionSchema.index({ schoolYear: 1, isActive: 1 });

module.exports = mongoose.model('Permission', permissionSchema);




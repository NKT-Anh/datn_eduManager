/**
 * Email Log Model
 * Lưu lịch sử gửi email trong hệ thống
 */

const mongoose = require('mongoose');

const EmailLogSchema = new mongoose.Schema({
  // ✅ Thông tin người gửi
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderName: {
    type: String,
    required: true,
  },
  senderEmail: {
    type: String,
    required: true,
  },
  senderRole: {
    type: String,
    enum: ['admin', 'teacher', 'student'],
    required: true,
  },
  senderTeacherFlags: {
    isHomeroom: { type: Boolean, default: false },
    isDepartmentHead: { type: Boolean, default: false },
    isLeader: { type: Boolean, default: false },
  },

  // ✅ Thông tin email
  recipientType: {
    type: String,
    enum: ['teachers', 'students', 'all', 'single', 'custom'],
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  fromEmail: {
    type: String,
    required: true,
  },
  fromName: {
    type: String,
    required: true,
  },

  // ✅ Phạm vi gửi (nếu có)
  scope: {
    type: {
      type: String,
      enum: ['all', 'homeroom_class', 'department', 'custom'],
      default: 'all',
    },
    homeroomClassId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    customRecipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },

  // ✅ Kết quả gửi
  totalRecipients: {
    type: Number,
    default: 0,
  },
  successCount: {
    type: Number,
    default: 0,
  },
  failedCount: {
    type: Number,
    default: 0,
  },
  errors: [{
    recipientEmail: String,
    recipientName: String,
    error: String,
  }],

  // ✅ Trạng thái
  status: {
    type: String,
    enum: ['pending', 'approved', 'sent', 'failed', 'cancelled'],
    default: 'sent',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  cancelledAt: {
    type: Date,
  },
  cancellationReason: {
    type: String,
  },

  // ✅ Metadata
  sentAt: {
    type: Date,
    default: Date.now,
  },
  schoolYear: {
    type: String,
  },
}, {
  timestamps: true,
});

// Indexes để tìm kiếm nhanh
EmailLogSchema.index({ senderId: 1, sentAt: -1 });
EmailLogSchema.index({ recipientType: 1, sentAt: -1 });
EmailLogSchema.index({ status: 1, sentAt: -1 });
EmailLogSchema.index({ 'scope.type': 1, 'scope.homeroomClassId': 1 });
EmailLogSchema.index({ 'scope.type': 1, 'scope.departmentId': 1 });

const EmailLog = mongoose.model('EmailLog', EmailLogSchema);

module.exports = EmailLog;


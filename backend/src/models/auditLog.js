const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userRole: {
      type: String,
      enum: ['admin', 'teacher', 'student', 'bgh'],
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userFlags: {
      type: {
        isHomeroom: { type: Boolean, default: false },
        isDepartmentHead: { type: Boolean, default: false },
        isLeader: { type: Boolean, default: false },
        permissions: { type: [String], default: [] },
        yearRoles: { type: mongoose.Schema.Types.Mixed, default: null }, // Lưu yearRoles của năm học hiện tại
      },
      default: null,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'LOGIN',
        'LOGOUT',
        'CREATE',
        'UPDATE',
        'DELETE',
        'VIEW',
        'EXPORT',
        'IMPORT',
        'APPROVE',
        'REJECT',
        'LOCK',
        'UNLOCK',
        'RESET_PASSWORD',
        'CHANGE_PASSWORD',
      ],
    },
    resource: {
      type: String,
      required: true,
      enum: [
        'USER',
        'STUDENT',
        'TEACHER',
        'CLASS',
        'SUBJECT',
        'GRADE',
        'EXAM',
        'ATTENDANCE',
        'TEACHING_ASSIGNMENT',
        'SCHOOL_YEAR',
        'PERMISSION',
        'NOTIFICATION',
        'SYSTEM',
      ],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    resourceName: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'PENDING'],
      default: 'SUCCESS',
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userRole: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;


const mongoose = require('mongoose');

// Schema cho SMTP config
const SmtpSchema = new mongoose.Schema({
  host: { type: String, default: '' },
  port: { type: Number, default: 587 },
  user: { type: String, default: '' },
  pass: { type: String, default: '' },
  fromEmail: { type: String, default: '' },
  fromName: { type: String, default: '' },
  secure: { type: Boolean, default: false },
}, { _id: false });

// Schema tổng thể Setting
const SettingSchema = new mongoose.Schema({
  schoolName: { type: String, default: 'Trường THPT Chưa đặt tên' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  website: { type: String, default: '' },

  currentSchoolYear: { type: String, default: '2025-2026' },
  termStart: { type: String, default: '' },
  termEnd: { type: String, default: '' },

  gradingScale: { type: String, enum: ['10', '4'], default: '10' },
  passThreshold: { type: Number, default: 5.0 },

  notifyEmail: { type: Boolean, default: true },
  notifySMS: { type: Boolean, default: false },
  notifyAbsence: { type: Boolean, default: true },
  notifyGrades: { type: Boolean, default: true },

  autoBackup: { type: String, enum: ['daily', 'weekly', 'monthly', 'never'], default: 'weekly' },
  retentionMonths: { type: Number, default: 12 },

  sessionTimeoutMinutes: { type: Number, default: 30 },
  passwordPolicy: { type: String, enum: ['basic', 'medium', 'strong'], default: 'medium' },
  twoFactor: { type: Boolean, default: false },

  smtp: { type: SmtpSchema, default: {} },

  studentEmailDomain: { type: String, default: 'student.school.com' },
  teacherEmailDomain: { type: String, default: 'teacher.school.com' },
  defaultPassword: { type: String, default: "123456" },

  // ✅ Cấu hình thời gian nhập điểm
  gradeEntryStartHK1: { type: String, default: '' },
  gradeEntryEndHK1: { type: String, default: '' },
  gradeEntryStartHK2: { type: String, default: '' },
  gradeEntryEndHK2: { type: String, default: '' },
  allowAdminGradeOverride: { type: Boolean, default: true }

}, { timestamps: true });

const Setting = mongoose.model('Setting', SettingSchema);

module.exports = Setting;

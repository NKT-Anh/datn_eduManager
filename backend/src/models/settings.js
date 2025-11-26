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
  slogan: { type: String, default: '' },
  description: { type: String, default: '' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  website: { type: String, default: '' },
  facebook: { type: String, default: '' },

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
  autoUploadToDrive: { type: Boolean, default: false }, // Tự động upload backup lên Google Drive

  sessionTimeoutMinutes: { type: Number, default: 30 },
  passwordPolicy: { type: String, enum: ['basic', 'medium', 'strong'], default: 'medium' },
  twoFactor: { type: Boolean, default: false },

  smtp: { type: SmtpSchema, default: {} },

  studentEmailDomain: { type: String, default: 'student.school.com' },
  teacherEmailDomain: { type: String, default: 'teacher.school.com' },
  adminEmailDomain: { type: String, default: 'admin.school.com' },
  bghEmailDomain: { type: String, default: 'bgh.school.com' },
  qlbmEmailDomain: { type: String, default: 'qlbm.school.com' },
  defaultPassword: { type: String, default: "123456" },

  // ✅ Cấu hình thời gian nhập điểm
  gradeEntryStartHK1: { type: String, default: '' },
  gradeEntryEndHK1: { type: String, default: '' },
  gradeEntryStartHK2: { type: String, default: '' },
  gradeEntryEndHK2: { type: String, default: '' },
  allowAdminGradeOverride: { type: Boolean, default: true },

  // ✅ Cấu hình thời gian nhập hạnh kiểm
  conductEntryStartHK1: { type: String, default: '' }, // Format: 'YYYY-MM-DD'
  conductEntryEndHK1: { type: String, default: '' },
  conductEntryStartHK2: { type: String, default: '' },
  conductEntryEndHK2: { type: String, default: '' },
  allowAdminConductOverride: { type: Boolean, default: true } // Admin có thể mở khóa khi cần

}, { timestamps: true });

const Setting = mongoose.model('Setting', SettingSchema);

module.exports = Setting;

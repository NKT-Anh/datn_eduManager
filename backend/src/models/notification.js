const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },

  // Loại thông báo
  type: {
    type: String,
    enum: [
      'exam',        // Lịch kiểm tra / lịch thi
      'holiday',     // Nghỉ học
      'grade',       // Điểm số / Kết quả học tập
      'rule',        // Quy định
      'homeroom',    // GVCN gửi cho lớp
      'event',       // Sự kiện, ngoại khóa
      'admission',   // Tuyển sinh
      'system',      // Thông báo hệ thống
      'general'      // Chung chung
    ],
    default: 'general'
  },

  // Độ ưu tiên
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },

  // Thời gian
  startDate: { type: Date },
  endDate: { type: Date },

  // Ai nhận thông báo
  recipientType: {
    type: String,
    enum: ['all', 'role', 'class', 'user'],
    default: 'all'
  },

  // Nếu gửi theo role
  recipientRole: {
    type: String,
    enum: ['student', 'teacher', 'parent', 'admin', 'leader', 'department_head', 'homeroom_teacher']
  },

  // Nếu gửi theo lớp
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },

  // Nếu gửi riêng người cụ thể
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },

  // ✅ Track ai đã đọc thông báo
  readBy: [{ 
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    readAt: { type: Date, default: Date.now }
  }],

  // ✅ Tệp đính kèm
  attachments: [{
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number }, // bytes
    fileType: { type: String }, // mime type
    uploadedAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

notificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);

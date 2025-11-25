const mongoose = require('mongoose');

/**
 * ✅ Model: Lưu thông tin backup
 */
const backupSchema = new mongoose.Schema({
  filename: { type: String, required: true }, // Tên file backup (ví dụ: backup-2025-01-25-123456.gz)
  filePath: { type: String, required: true }, // Đường dẫn file trên server local
  fileSize: { type: Number, required: true }, // Kích thước file (bytes)
  storageType: { 
    type: String, 
    enum: ['local', 'google_drive', 'both'], 
    default: 'local' 
  }, // Loại lưu trữ
  googleDriveFileId: { type: String, default: null }, // ID file trên Google Drive (nếu có)
  googleDriveUrl: { type: String, default: null }, // URL file trên Google Drive (nếu có)
  status: { 
    type: String, 
    enum: ['creating', 'completed', 'failed', 'uploading'], 
    default: 'creating' 
  }, // Trạng thái backup
  error: { type: String, default: null }, // Lỗi (nếu có)
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account',
    default: null 
  }, // Người tạo backup (null nếu là auto backup)
  isAutoBackup: { type: Boolean, default: false }, // Có phải backup tự động không
  backupType: { 
    type: String, 
    enum: ['manual', 'daily', 'weekly', 'monthly'], 
    default: 'manual' 
  }, // Loại backup
  description: { type: String, default: '' }, // Mô tả (nếu có)
}, { timestamps: true });

// Index để tìm kiếm nhanh
backupSchema.index({ createdAt: -1 });
backupSchema.index({ status: 1 });
backupSchema.index({ storageType: 1 });

const Backup = mongoose.model('Backup', backupSchema);

module.exports = Backup;


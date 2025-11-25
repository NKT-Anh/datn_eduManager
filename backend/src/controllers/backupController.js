const Backup = require('../models/backup');
const Setting = require('../models/settings');
const { createMongoBackup, restoreMongoBackup, cleanupOldBackups } = require('../utils/backupHelper');
const path = require('path');
const fs = require('fs').promises;

// ✅ Lazy load Google Drive helper để tránh lỗi nếu không cài đặt
let googleDriveHelper = null;
function getGoogleDriveHelper() {
  if (!googleDriveHelper) {
    try {
      googleDriveHelper = require('../utils/googleDriveHelper');
    } catch (error) {
      console.warn('⚠️ [Backup] Google Drive helper không khả dụng:', error.message);
      return null;
    }
  }
  return googleDriveHelper;
}

/**
 * ✅ Tạo backup mới
 */
exports.createBackup = async (req, res) => {
  try {
    const { storageType = 'local', uploadToDrive = false, description = '' } = req.body;
    const userId = req.user?.accountId || null;

    // Lấy cấu hình backup directory (normalize path cho Windows)
    const backupDir = process.env.BACKUP_DIR 
      ? path.normalize(process.env.BACKUP_DIR.replace(/\\/g, '/'))
      : path.join(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    // Lấy database name từ connection string
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/eduschool';
    let dbName = 'eduschool';
    if (mongoUri.includes('/')) {
      const uriParts = mongoUri.split('/');
      dbName = uriParts[uriParts.length - 1].split('?')[0];
    }

    // Tạo backup record với status 'creating'
    const backup = new Backup({
      filename: '', // Sẽ cập nhật sau
      filePath: '',
      fileSize: 0,
      storageType: uploadToDrive ? 'both' : 'local',
      status: 'creating',
      createdBy: userId,
      isAutoBackup: false,
      backupType: 'manual',
      description,
    });
    await backup.save();

    try {
      // Tạo backup file
      const backupResult = await createMongoBackup(backupDir, dbName);
      
      backup.filename = backupResult.filename;
      backup.filePath = backupResult.filePath;
      backup.fileSize = backupResult.fileSize;
      backup.status = uploadToDrive ? 'uploading' : 'completed';
      await backup.save();

      // Upload lên Google Drive nếu được yêu cầu
      if (uploadToDrive && process.env.GOOGLE_DRIVE_CREDENTIALS) {
        const gdHelper = getGoogleDriveHelper();
        if (gdHelper) {
          try {
            // Tạo hoặc lấy folder backup trên Drive
            let driveFolderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
            if (!driveFolderId) {
              driveFolderId = await gdHelper.createFolderOnGoogleDrive('EduManage Backups');
              // Có thể lưu vào settings hoặc env
            }

            const driveResult = await gdHelper.uploadToGoogleDrive(
              backupResult.filePath,
              backupResult.filename,
              driveFolderId
            );

            backup.googleDriveFileId = driveResult.fileId;
            backup.googleDriveUrl = driveResult.webViewLink;
            backup.storageType = 'both';
            backup.status = 'completed';
            await backup.save();
          } catch (driveError) {
            console.error('❌ [Backup] Lỗi khi upload lên Google Drive:', driveError);
            backup.error = `Upload Drive thất bại: ${driveError.message}`;
            backup.status = 'completed'; // Vẫn giữ backup local
            await backup.save();
          }
        } else {
          console.warn('⚠️ [Backup] Google Drive helper không khả dụng, chỉ lưu local');
          backup.status = 'completed';
          await backup.save();
        }
      }

      // Cleanup backup cũ
      const settings = await Setting.findOne().lean();
      const retentionMonths = settings?.retentionMonths || 12;
      await cleanupOldBackups(backupDir, retentionMonths);

      res.json({
        message: 'Tạo backup thành công',
        backup: {
          _id: backup._id,
          filename: backup.filename,
          fileSize: backup.fileSize,
          storageType: backup.storageType,
          status: backup.status,
          createdAt: backup.createdAt,
          googleDriveUrl: backup.googleDriveUrl,
        },
      });
    } catch (error) {
      backup.status = 'failed';
      backup.error = error.message;
      await backup.save();

      res.status(500).json({
        message: 'Lỗi khi tạo backup',
        error: error.message,
      });
    }
  } catch (error) {
    console.error('❌ [Backup] Lỗi:', error);
    res.status(500).json({ message: 'Lỗi khi tạo backup', error: error.message });
  }
};

/**
 * ✅ Lấy danh sách backup
 */
exports.getBackups = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, storageType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) query.status = status;
    if (storageType) query.storageType = storageType;

    const backups = await Backup.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .lean();

    const total = await Backup.countDocuments(query);

    res.json({
      backups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ [Backup] Lỗi khi lấy danh sách:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách backup', error: error.message });
  }
};

/**
 * ✅ Download backup file
 */
exports.downloadBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await Backup.findById(id);

    if (!backup) {
      return res.status(404).json({ message: 'Không tìm thấy backup' });
    }

    if (backup.status !== 'completed') {
      return res.status(400).json({ message: 'Backup chưa hoàn thành' });
    }

    // Kiểm tra file có tồn tại không
    try {
      await fs.access(backup.filePath);
    } catch (error) {
      return res.status(404).json({ message: 'File backup không tồn tại trên server' });
    }

    res.download(backup.filePath, backup.filename, (err) => {
      if (err) {
        console.error('❌ [Backup] Lỗi khi download:', err);
        res.status(500).json({ message: 'Lỗi khi download backup' });
      }
    });
  } catch (error) {
    console.error('❌ [Backup] Lỗi:', error);
    res.status(500).json({ message: 'Lỗi khi download backup', error: error.message });
  }
};

/**
 * ✅ Restore backup
 */
exports.restoreBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirm = false } = req.body;

    if (!confirm) {
      return res.status(400).json({ message: 'Cần xác nhận restore (confirm: true)' });
    }

    const backup = await Backup.findById(id);
    if (!backup) {
      return res.status(404).json({ message: 'Không tìm thấy backup' });
    }

    if (backup.status !== 'completed') {
      return res.status(400).json({ message: 'Backup chưa hoàn thành' });
    }

    // Kiểm tra file có tồn tại không
    try {
      await fs.access(backup.filePath);
    } catch (error) {
      return res.status(404).json({ message: 'File backup không tồn tại trên server' });
    }

    // Lấy database name
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/eduschool';
    let dbName = 'eduschool';
    if (mongoUri.includes('/')) {
      const uriParts = mongoUri.split('/');
      dbName = uriParts[uriParts.length - 1].split('?')[0];
    }

    // Restore backup
    await restoreMongoBackup(backup.filePath, dbName);

    res.json({ message: 'Restore backup thành công' });
  } catch (error) {
    console.error('❌ [Backup] Lỗi khi restore:', error);
    res.status(500).json({ message: 'Lỗi khi restore backup', error: error.message });
  }
};

/**
 * ✅ Xóa backup
 */
exports.deleteBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await Backup.findById(id);

    if (!backup) {
      return res.status(404).json({ message: 'Không tìm thấy backup' });
    }

    // Xóa file trên server local
    try {
      await fs.unlink(backup.filePath);
    } catch (error) {
      console.warn('⚠️ [Backup] Không thể xóa file local:', error.message);
    }

    // Xóa file trên Google Drive nếu có
    if (backup.googleDriveFileId && process.env.GOOGLE_DRIVE_CREDENTIALS) {
      const gdHelper = getGoogleDriveHelper();
      if (gdHelper) {
        try {
          await gdHelper.deleteFromGoogleDrive(backup.googleDriveFileId);
        } catch (error) {
          console.warn('⚠️ [Backup] Không thể xóa file trên Drive:', error.message);
        }
      }
    }

    // Xóa record
    await Backup.findByIdAndDelete(id);

    res.json({ message: 'Xóa backup thành công' });
  } catch (error) {
    console.error('❌ [Backup] Lỗi khi xóa:', error);
    res.status(500).json({ message: 'Lỗi khi xóa backup', error: error.message });
  }
};

/**
 * ✅ Lấy thống kê backup
 */
exports.getBackupStats = async (req, res) => {
  try {
    const totalBackups = await Backup.countDocuments();
    const completedBackups = await Backup.countDocuments({ status: 'completed' });
    const failedBackups = await Backup.countDocuments({ status: 'failed' });
    const localBackups = await Backup.countDocuments({ storageType: 'local' });
    const driveBackups = await Backup.countDocuments({ storageType: { $in: ['google_drive', 'both'] } });

    // Tính tổng dung lượng
    const backups = await Backup.find({ status: 'completed' }).select('fileSize').lean();
    const totalSize = backups.reduce((sum, b) => sum + (b.fileSize || 0), 0);

    // Backup gần nhất
    const latestBackup = await Backup.findOne({ status: 'completed' })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      totalBackups,
      completedBackups,
      failedBackups,
      localBackups,
      driveBackups,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      latestBackup: latestBackup ? {
        filename: latestBackup.filename,
        createdAt: latestBackup.createdAt,
        fileSize: latestBackup.fileSize,
      } : null,
    });
  } catch (error) {
    console.error('❌ [Backup] Lỗi khi lấy thống kê:', error);
    res.status(500).json({ message: 'Lỗi khi lấy thống kê', error: error.message });
  }
};


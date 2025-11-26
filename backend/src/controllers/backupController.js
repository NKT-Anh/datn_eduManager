const Backup = require('../models/backup');
const Setting = require('../models/settings');
const { createMongoBackup, createMongoBackupJSON, restoreMongoBackup, restoreMongoBackupJSON, cleanupOldBackups } = require('../utils/backupHelper');
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

    let backup = null;
    try {
      // ✅ Tạo backup file bằng JSON export (không cần mongodump)
      console.log(`🔄 [Backup] Bắt đầu tạo backup cho database: ${dbName}`);
      
      // Sử dụng phương pháp JSON export (không cần mongodump)
      const backupResult = await createMongoBackupJSON(backupDir, {
        // Có thể tùy chỉnh: chỉ backup một số collections cụ thể
        // collections: ['users', 'classes', 'subjects'],
        // excludeCollections: ['auditlogs', 'emaillogs'] // Loại bỏ logs nếu muốn
      });
      
      console.log(`✅ [Backup] Đã tạo backup file: ${backupResult.filename}`);
      
      // ✅ Tạo backup record sau khi đã có file
      backup = new Backup({
        filename: backupResult.filename,
        filePath: backupResult.filePath,
        fileSize: backupResult.fileSize,
        storageType: uploadToDrive ? 'both' : 'local',
        status: uploadToDrive ? 'uploading' : 'completed',
        createdBy: userId,
        isAutoBackup: false,
        backupType: 'manual',
        description,
      });
      await backup.save();
      console.log(`✅ [Backup] Đã lưu backup record vào database`);

      // ✅ Upload lên Google Drive nếu được yêu cầu
      if (uploadToDrive) {
        if (!process.env.GOOGLE_DRIVE_CREDENTIALS) {
          console.warn('⚠️ [Backup] GOOGLE_DRIVE_CREDENTIALS chưa được cấu hình, chỉ lưu local');
          backup.error = 'Google Drive chưa được cấu hình trong môi trường';
          backup.status = 'completed';
          await backup.save();
        } else {
          const gdHelper = getGoogleDriveHelper();
          if (gdHelper) {
            try {
              console.log(`🔄 [Backup] Bắt đầu upload lên Google Drive...`);
              // Tạo hoặc lấy folder backup trên Drive
              let driveFolderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
              if (!driveFolderId) {
                console.log(`📁 [Backup] Tạo folder mới trên Google Drive...`);
                driveFolderId = await gdHelper.createFolderOnGoogleDrive('EduManage Backups');
                console.log(`✅ [Backup] Đã tạo folder với ID: ${driveFolderId}`);
                // Có thể lưu vào settings hoặc env
              }

              console.log(`📤 [Backup] Đang upload file: ${backupResult.filename} (${(backupResult.fileSize / 1024 / 1024).toFixed(2)} MB)...`);
              try {
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
                
                console.log(`✅ [Backup] Đã upload lên Google Drive thành công!`);
                console.log(`   - File ID: ${driveResult.fileId}`);
                console.log(`   - URL: ${driveResult.webViewLink}`);
              } catch (driveError) {
                // Nếu lỗi upload Google Drive, vẫn lưu backup local
                console.warn(`⚠️ [Backup] Không thể upload lên Google Drive: ${driveError.message}`);
                console.log(`ℹ️ [Backup] Backup đã được lưu local tại: ${backupResult.filePath}`);
                console.warn(`ℹ️ [Backup] Để upload lên Google Drive, vui lòng kiểm tra file credentials: ${process.env.GOOGLE_DRIVE_CREDENTIALS || 'chưa cấu hình'}`);
                backup.storageType = 'local';
                backup.status = 'completed';
                backup.error = `Upload Google Drive thất bại: ${driveError.message}`;
                await backup.save();
              }
            } catch (driveError) {
              console.error('❌ [Backup] Lỗi khi upload lên Google Drive:', driveError);
              console.warn(`⚠️ [Backup] Backup vẫn được lưu local tại: ${backupResult.filePath}`);
              console.warn(`ℹ️ [Backup] Để upload lên Google Drive, vui lòng kiểm tra file credentials: ${process.env.GOOGLE_DRIVE_CREDENTIALS || 'chưa cấu hình'}`);
              backup.error = `Upload Drive thất bại: ${driveError.message}`;
              backup.status = 'completed'; // Vẫn giữ backup local
              backup.storageType = 'local'; // Chỉ lưu local
              await backup.save();
            }
          } else {
            console.warn('⚠️ [Backup] Google Drive helper không khả dụng, chỉ lưu local');
            backup.error = 'Google Drive helper không khả dụng';
            backup.status = 'completed';
            await backup.save();
          }
        }
      } else {
        console.log(`ℹ️ [Backup] Không upload lên Google Drive (uploadToDrive = false)`);
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
      console.error('❌ [Backup] Lỗi khi tạo backup:', error);
      
      // ✅ Nếu đã tạo backup record nhưng chưa hoàn thành, cập nhật status
      if (backup && backup._id) {
        backup.status = 'failed';
        backup.error = error.message;
        try {
          await backup.save();
        } catch (saveError) {
          console.error('❌ [Backup] Lỗi khi lưu trạng thái failed:', saveError);
        }
      }

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

    // ✅ Restore backup - sử dụng phương pháp JSON nếu là file JSON backup
    if (backup.filename.includes('json-') || backup.filename.endsWith('.json.tar.gz')) {
      // Sử dụng phương pháp JSON restore
      console.log(`🔄 [Restore] Sử dụng phương pháp JSON restore`);
      await restoreMongoBackupJSON(backup.filePath, {
        dropExisting: true, // Xóa dữ liệu cũ trước khi restore
        // Có thể chỉ định collections cụ thể: collections: ['users', 'classes']
      });
    } else {
      // Sử dụng phương pháp mongorestore (cho backup cũ)
      console.log(`🔄 [Restore] Sử dụng phương pháp mongorestore`);
      const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/eduschool';
      let dbName = 'eduschool';
      if (mongoUri.includes('/')) {
        const uriParts = mongoUri.split('/');
        dbName = uriParts[uriParts.length - 1].split('?')[0];
      }
      await restoreMongoBackup(backup.filePath, dbName);
    }

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

/**
 * ✅ Upload backup file từ web
 */
exports.uploadBackupFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Không có file được upload' });
    }

    const userId = req.user?.accountId || null;
    const { description = '' } = req.body;

    // Lấy thông tin file
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Tạo tên file mới (giữ extension)
    const ext = path.extname(originalName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const newFilename = `backup-uploaded-${timestamp}${ext}`;

    // Đổi tên file để có format chuẩn
    const newFilePath = path.join(path.dirname(filePath), newFilename);
    await fs.rename(filePath, newFilePath);

    // Tạo backup record
    const backup = new Backup({
      filename: newFilename,
      filePath: newFilePath,
      fileSize: fileSize,
      storageType: 'local',
      status: 'completed',
      createdBy: userId,
      isAutoBackup: false,
      backupType: 'manual',
      description: description || `Upload từ web: ${originalName}`,
    });
    await backup.save();

    console.log(`✅ [Backup] Đã upload backup file: ${newFilename} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    res.status(201).json({
      message: 'Upload backup thành công',
      backup: {
        _id: backup._id,
        filename: backup.filename,
        fileSize: backup.fileSize,
        storageType: backup.storageType,
        status: backup.status,
        createdAt: backup.createdAt,
        originalName: originalName,
      },
    });
  } catch (error) {
    console.error('❌ [Backup] Lỗi khi upload backup file:', error);
    
    // Xóa file nếu đã upload nhưng lỗi khi lưu record
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('❌ [Backup] Lỗi khi xóa file tạm:', unlinkError);
      }
    }

    res.status(500).json({
      message: 'Lỗi khi upload backup file',
      error: error.message,
    });
  }
};

/**
 * ✅ Restore từ file backup đã upload
 */
exports.restoreUploadedBackup = async (req, res) => {
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

    console.log(`🔄 [Restore] Bắt đầu restore từ file đã upload: ${backup.filename}`);

    // ✅ Restore backup - tự động phát hiện loại file
    if (backup.filename.includes('json-') || backup.filename.endsWith('.json.tar.gz')) {
      // Sử dụng phương pháp JSON restore
      console.log(`🔄 [Restore] Sử dụng phương pháp JSON restore`);
      await restoreMongoBackupJSON(backup.filePath, {
        dropExisting: true,
      });
    } else {
      // Sử dụng phương pháp mongorestore (cho backup cũ)
      console.log(`🔄 [Restore] Sử dụng phương pháp mongorestore`);
      const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/eduschool';
      let dbName = 'eduschool';
      if (mongoUri.includes('/')) {
        const uriParts = mongoUri.split('/');
        dbName = uriParts[uriParts.length - 1].split('?')[0];
      }
      await restoreMongoBackup(backup.filePath, dbName);
    }

    console.log(`✅ [Restore] Restore từ file upload thành công`);

    res.json({ 
      message: 'Restore backup thành công',
      backup: {
        _id: backup._id,
        filename: backup.filename,
      }
    });
  } catch (error) {
    console.error('❌ [Backup] Lỗi khi restore:', error);
    res.status(500).json({ 
      message: 'Lỗi khi restore backup', 
      error: error.message 
    });
  }
};


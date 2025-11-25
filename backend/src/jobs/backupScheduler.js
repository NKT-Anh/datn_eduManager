const Backup = require('../models/backup');
const Setting = require('../models/settings');
const { createMongoBackup, cleanupOldBackups } = require('../utils/backupHelper');
const path = require('path');
const fs = require('fs').promises;

// ✅ Lazy load cron và Google Drive helper
let cron = null;
function getCron() {
  if (!cron) {
    try {
      cron = require('node-cron');
    } catch (error) {
      console.warn('⚠️ [Backup Scheduler] node-cron chưa được cài đặt:', error.message);
      return null;
    }
  }
  return cron;
}

let googleDriveHelper = null;
function getGoogleDriveHelper() {
  if (!googleDriveHelper) {
    try {
      googleDriveHelper = require('../utils/googleDriveHelper');
    } catch (error) {
      console.warn('⚠️ [Backup Scheduler] Google Drive helper không khả dụng:', error.message);
      return null;
    }
  }
  return googleDriveHelper;
}

/**
 * ✅ Tạo backup tự động
 */
async function createAutoBackup(backupType = 'daily') {
  try {
    console.log(`🔄 [Auto Backup] Bắt đầu tạo backup tự động (${backupType})...`);

    const settings = await Setting.findOne().lean();
    if (!settings || settings.autoBackup === 'never') {
      console.log('⚠️ [Auto Backup] Auto backup đã bị tắt');
      return;
    }

    // Kiểm tra xem có cần tạo backup không
    const shouldBackup = 
      (backupType === 'daily' && settings.autoBackup === 'daily') ||
      (backupType === 'weekly' && settings.autoBackup === 'weekly') ||
      (backupType === 'monthly' && settings.autoBackup === 'monthly');

    if (!shouldBackup) {
      return;
    }

    // Normalize path cho Windows
    const backupDir = process.env.BACKUP_DIR 
      ? path.normalize(process.env.BACKUP_DIR.replace(/\\/g, '/'))
      : path.join(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    // Lấy database name
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/eduschool';
    let dbName = 'eduschool';
    if (mongoUri.includes('/')) {
      const uriParts = mongoUri.split('/');
      dbName = uriParts[uriParts.length - 1].split('?')[0];
    }

    // Tạo backup record
    const backup = new Backup({
      filename: '',
      filePath: '',
      fileSize: 0,
      storageType: process.env.GOOGLE_DRIVE_CREDENTIALS ? 'both' : 'local',
      status: 'creating',
      createdBy: null,
      isAutoBackup: true,
      backupType,
      description: `Backup tự động ${backupType}`,
    });
    await backup.save();

    try {
      // Tạo backup file
      const backupResult = await createMongoBackup(backupDir, dbName);
      
      backup.filename = backupResult.filename;
      backup.filePath = backupResult.filePath;
      backup.fileSize = backupResult.fileSize;
      backup.status = process.env.GOOGLE_DRIVE_CREDENTIALS ? 'uploading' : 'completed';
      await backup.save();

      // Upload lên Google Drive nếu được cấu hình
      if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
        const gdHelper = getGoogleDriveHelper();
        if (gdHelper) {
          try {
            let driveFolderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
            if (!driveFolderId) {
              driveFolderId = await gdHelper.createFolderOnGoogleDrive('EduManage Backups');
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
            console.error('❌ [Auto Backup] Lỗi khi upload lên Google Drive:', driveError);
            backup.error = `Upload Drive thất bại: ${driveError.message}`;
            backup.status = 'completed'; // Vẫn giữ backup local
            await backup.save();
          }
        } else {
          console.warn('⚠️ [Auto Backup] Google Drive helper không khả dụng, chỉ lưu local');
          backup.status = 'completed';
          await backup.save();
        }
      }

      // Cleanup backup cũ
      const retentionMonths = settings?.retentionMonths || 12;
      await cleanupOldBackups(backupDir, retentionMonths);

      console.log(`✅ [Auto Backup] Tạo backup thành công: ${backupResult.filename}`);
    } catch (error) {
      backup.status = 'failed';
      backup.error = error.message;
      await backup.save();
      console.error('❌ [Auto Backup] Lỗi khi tạo backup:', error);
    }
  } catch (error) {
    console.error('❌ [Auto Backup] Lỗi:', error);
  }
}

/**
 * ✅ Khởi tạo scheduled backup jobs
 */
function initBackupScheduler() {
  const cronLib = getCron();
  if (!cronLib) {
    console.warn('⚠️ [Backup Scheduler] node-cron chưa được cài đặt, bỏ qua scheduled jobs');
    return;
  }

  // Daily backup: 2:00 AM mỗi ngày
  cronLib.schedule('0 2 * * *', () => {
    createAutoBackup('daily');
  });

  // Weekly backup: 2:00 AM mỗi Chủ nhật
  cronLib.schedule('0 2 * * 0', () => {
    createAutoBackup('weekly');
  });

  // Monthly backup: 2:00 AM ngày 1 mỗi tháng
  cronLib.schedule('0 2 1 * *', () => {
    createAutoBackup('monthly');
  });

  console.log('✅ [Backup Scheduler] Đã khởi tạo scheduled backup jobs');
}

module.exports = {
  createAutoBackup,
  initBackupScheduler,
};


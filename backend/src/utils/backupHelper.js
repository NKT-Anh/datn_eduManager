const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const execAsync = promisify(exec);

/**
 * ✅ Tạo backup MongoDB bằng mongodump
 * @param {string} outputDir - Thư mục lưu backup
 * @param {string} dbName - Tên database (từ connection string)
 * @returns {Promise<{filePath: string, fileSize: number}>}
 */
async function createMongoBackup(outputDir, dbName) {
  try {
    // Đảm bảo thư mục tồn tại
    await fs.mkdir(outputDir, { recursive: true });

    // Tạo tên file backup với timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `backup-${timestamp}.gz`;
    const backupFilePath = path.join(outputDir, backupFileName);

    // Lấy MongoDB connection string từ environment
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/eduschool';
    
    // Parse connection string để lấy database name
    let actualDbName = dbName;
    if (!actualDbName && mongoUri.includes('/')) {
      const uriParts = mongoUri.split('/');
      actualDbName = uriParts[uriParts.length - 1].split('?')[0];
    }
    if (!actualDbName) {
      actualDbName = 'eduschool'; // Fallback
    }

    // Tạo temp directory cho mongodump
    const tempDir = path.join(outputDir, `temp-${timestamp}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Chạy mongodump
    const mongodumpCmd = `mongodump --uri="${mongoUri}" --db="${actualDbName}" --out="${tempDir}"`;
    
    console.log(`🔄 [Backup] Đang chạy mongodump...`);
    const { stdout, stderr } = await execAsync(mongodumpCmd);
    
    if (stderr && !stderr.includes('writing') && !stderr.includes('done')) {
      console.warn(`⚠️ [Backup] mongodump stderr: ${stderr}`);
    }

    // Nén backup thành file .gz
    console.log(`🔄 [Backup] Đang nén backup...`);
    const dumpPath = path.join(tempDir, actualDbName);
    
    // Kiểm tra xem dumpPath có tồn tại không
    try {
      await fs.access(dumpPath);
    } catch (error) {
      throw new Error(`Không tìm thấy thư mục dump: ${dumpPath}`);
    }

    // Nén thư mục dump thành file .gz
    await compressDirectory(dumpPath, backupFilePath);

    // Xóa thư mục temp
    await fs.rm(tempDir, { recursive: true, force: true });

    // Lấy kích thước file
    const stats = await fs.stat(backupFilePath);
    const fileSize = stats.size;

    console.log(`✅ [Backup] Tạo backup thành công: ${backupFileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    return {
      filePath: backupFilePath,
      filename: backupFileName,
      fileSize
    };
  } catch (error) {
    console.error('❌ [Backup] Lỗi khi tạo backup:', error);
    throw error;
  }
}

/**
 * ✅ Nén thư mục thành file .gz
 */
async function compressDirectory(sourceDir, outputFile) {
  try {
    // Thử dùng tar package trước
    const tar = require('tar');
    await tar.create(
      {
        gzip: true,
        file: outputFile,
        cwd: path.dirname(sourceDir),
      },
      [path.basename(sourceDir)]
    );
  } catch (error) {
    // Fallback: dùng tar command nếu package tar không có hoặc lỗi
    console.log('⚠️ [Backup] Dùng tar command thay vì package tar');
    const tarCmd = process.platform === 'win32' 
      ? `tar -czf "${outputFile}" -C "${path.dirname(sourceDir)}" "${path.basename(sourceDir)}"`
      : `tar -czf "${outputFile}" -C "${path.dirname(sourceDir)}" "${path.basename(sourceDir)}"`;
    await execAsync(tarCmd);
  }
}

/**
 * ✅ Restore backup từ file .gz
 * @param {string} backupFilePath - Đường dẫn file backup
 * @param {string} dbName - Tên database để restore
 */
async function restoreMongoBackup(backupFilePath, dbName) {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/eduschool';
    
    // Parse database name
    let actualDbName = dbName;
    if (!actualDbName && mongoUri.includes('/')) {
      const uriParts = mongoUri.split('/');
      actualDbName = uriParts[uriParts.length - 1].split('?')[0];
    }
    if (!actualDbName) {
      actualDbName = 'eduschool';
    }

    // Giải nén file backup
    const tempDir = path.join(path.dirname(backupFilePath), `restore-temp-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    console.log(`🔄 [Restore] Đang giải nén backup...`);
    
    // Giải nén file .gz
    try {
      const tar = require('tar');
      await tar.extract({
        file: backupFilePath,
        cwd: tempDir,
      });
    } catch (error) {
      // Fallback: dùng tar command
      console.log('⚠️ [Restore] Dùng tar command thay vì package tar');
      const tarCmd = process.platform === 'win32'
        ? `tar -xzf "${backupFilePath}" -C "${tempDir}"`
        : `tar -xzf "${backupFilePath}" -C "${tempDir}"`;
      await execAsync(tarCmd);
    }

    // Tìm thư mục dump
    const entries = await fs.readdir(tempDir);
    const dumpDir = entries.find(entry => {
      const fullPath = path.join(tempDir, entry);
      return fs.stat(fullPath).then(stat => stat.isDirectory()).catch(() => false);
    });

    if (!dumpDir) {
      throw new Error('Không tìm thấy thư mục dump trong backup');
    }

    const dumpPath = path.join(tempDir, dumpDir);

    // Restore bằng mongorestore
    console.log(`🔄 [Restore] Đang restore database...`);
    const mongorestoreCmd = `mongorestore --uri="${mongoUri}" --db="${actualDbName}" --drop "${dumpPath}"`;
    
    const { stdout, stderr } = await execAsync(mongorestoreCmd);
    
    if (stderr && !stderr.includes('finished') && !stderr.includes('done')) {
      console.warn(`⚠️ [Restore] mongorestore stderr: ${stderr}`);
    }

    // Xóa thư mục temp
    await fs.rm(tempDir, { recursive: true, force: true });

    console.log(`✅ [Restore] Restore backup thành công`);
  } catch (error) {
    console.error('❌ [Restore] Lỗi khi restore backup:', error);
    throw error;
  }
}

/**
 * ✅ Xóa các backup cũ (dựa trên retentionMonths)
 */
async function cleanupOldBackups(backupDir, retentionMonths) {
  try {
    const files = await fs.readdir(backupDir);
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - retentionMonths, now.getDate());

    let deletedCount = 0;
    for (const file of files) {
      if (!file.startsWith('backup-') || !file.endsWith('.gz')) continue;

      const filePath = path.join(backupDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deletedCount++;
        console.log(`🗑️ [Backup] Đã xóa backup cũ: ${file}`);
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ [Backup] Đã xóa ${deletedCount} backup cũ`);
    }

    return deletedCount;
  } catch (error) {
    console.error('❌ [Backup] Lỗi khi cleanup backup cũ:', error);
    throw error;
  }
}

module.exports = {
  createMongoBackup,
  restoreMongoBackup,
  cleanupOldBackups
};


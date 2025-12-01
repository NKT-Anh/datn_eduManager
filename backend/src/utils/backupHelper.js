const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const mongoose = require('mongoose');

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
      let parsedDbName = uriParts[uriParts.length - 1].split('?')[0];
      // ✅ Loại bỏ dấu chấm và các ký tự không hợp lệ trong tên database
      // MongoDB không cho phép: /, \, ., ", $, space, null character
      parsedDbName = parsedDbName.replace(/[\/\\\.\"\$\s]/g, '_');
      actualDbName = parsedDbName || 'eduschool';
    }
    if (!actualDbName) {
      actualDbName = 'eduschool'; // Fallback
    }
    // ✅ Đảm bảo tên database không chứa ký tự không hợp lệ
    actualDbName = actualDbName.replace(/[\/\\\.\"\$\s]/g, '_');

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
 * @param {string} sourceDir - Thư mục cần nén
 * @param {string} outputFile - File output
 * @param {number} compressionLevel - Mức nén từ 1-9 (1=fast, 9=best)
 */
async function compressDirectory(sourceDir, outputFile, compressionLevel = 6) {
  try {
    // Đảm bảo compressionLevel trong khoảng 1-9
    const level = Math.max(1, Math.min(9, compressionLevel || 6));
    
    // Thử dùng tar package trước (hỗ trợ compression level)
    const tar = require('tar');
    await tar.create(
      {
        gzip: {
          level: level // Mức nén (1-9)
        },
        file: outputFile,
        cwd: path.dirname(sourceDir),
      },
      [path.basename(sourceDir)]
    );
    console.log(`✅ [Backup] Đã nén với compression level ${level}`);
  } catch (error) {
    // Fallback: dùng tar command nếu package tar không có hoặc lỗi
    console.log('⚠️ [Backup] Dùng tar command thay vì package tar');
    // Tar command không hỗ trợ compression level trực tiếp, dùng gzip riêng
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
      let parsedDbName = uriParts[uriParts.length - 1].split('?')[0];
      // ✅ Loại bỏ dấu chấm và các ký tự không hợp lệ trong tên database
      // MongoDB không cho phép: /, \, ., ", $, space, null character
      parsedDbName = parsedDbName.replace(/[\/\\\.\"\$\s]/g, '_');
      actualDbName = parsedDbName || 'eduschool';
    }
    if (!actualDbName) {
      actualDbName = 'eduschool';
    }
    // ✅ Đảm bảo tên database không chứa ký tự không hợp lệ
    actualDbName = actualDbName.replace(/[\/\\\.\"\$\s]/g, '_');

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

/**
 * ✅ Tạo backup MongoDB bằng cách export dữ liệu từ các collection ra JSON
 * Không cần mongodump, chỉ cần Node.js và Mongoose
 * @param {string} outputDir - Thư mục lưu backup
 * @param {Object} options - Tùy chọn: 
 *   - collections: mảng tên collection cần backup
 *   - excludeCollections: mảng tên collection cần loại bỏ
 *   - excludeLargeCollections: boolean, tự động loại bỏ collections lớn (logs, audit)
 *   - compressionLevel: số từ 1-9 (1=fast, 9=best compression)
 *   - onProgress: callback function để cập nhật tiến độ
 * @returns {Promise<{filePath: string, filename: string, fileSize: number, metadata: object}>}
 */
async function createMongoBackupJSON(outputDir, options = {}) {
  try {
    const { 
      collections = null, 
      excludeCollections = [],
      excludeLargeCollections = true, // Mặc định loại bỏ logs và audit
      compressionLevel = 6, // Mức nén mặc định (1-9)
      onProgress = null // Callback để cập nhật progress
    } = options;
    
    // Đảm bảo thư mục tồn tại
    await fs.mkdir(outputDir, { recursive: true });

    // Tạo tên file backup với timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `backup-json-${timestamp}.tar.gz`;
    const backupFilePath = path.join(outputDir, backupFileName);

    // Tạo thư mục temp để lưu các file JSON
    const tempDir = path.join(outputDir, `temp-json-${timestamp}`);
    await fs.mkdir(tempDir, { recursive: true });

    console.log(`🔄 [Backup JSON] Bắt đầu export dữ liệu từ MongoDB...`);

    // Lấy connection từ mongoose
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection chưa được khởi tạo');
    }

    // Lấy danh sách tất cả collections
    const allCollections = await db.listCollections().toArray();
    const collectionNames = allCollections.map(c => c.name);

    // Lọc collections theo options
    let collectionsToBackup = collectionNames;
    if (collections && Array.isArray(collections) && collections.length > 0) {
      collectionsToBackup = collections.filter(c => collectionNames.includes(c));
    }
    
    // ✅ Danh sách collections lớn/thường không cần backup (logs, audit)
    const largeCollectionsToExclude = [
      'auditlogs',
      'emaillogs', 
      'auditlog',
      'emaillog',
      'logs',
      'systemlogs'
    ];

    // Loại bỏ các collections không cần backup
    collectionsToBackup = collectionsToBackup.filter(c => {
      // Loại bỏ system collections
      if (c.startsWith('system.')) return false;
      // Loại bỏ collections trong exclude list
      if (excludeCollections.includes(c)) return false;
      // Loại bỏ collections lớn nếu excludeLargeCollections = true
      if (excludeLargeCollections && largeCollectionsToExclude.some(lc => 
        c.toLowerCase().includes(lc.toLowerCase())
      )) {
        return false;
      }
      return true;
    });

    console.log(`📋 [Backup JSON] Sẽ backup ${collectionsToBackup.length} collections: ${collectionsToBackup.join(', ')}`);
    
    // ✅ Gửi progress ban đầu
    if (onProgress) {
      onProgress({
        stage: 'preparing',
        current: 0,
        total: collectionsToBackup.length,
        message: `Chuẩn bị backup ${collectionsToBackup.length} collections...`,
        percentage: 0
      });
    }

    // Export từng collection
    const backupMetadata = {
      timestamp: new Date().toISOString(),
      collections: [],
      totalDocuments: 0,
      totalSize: 0,
      excludedCollections: excludeLargeCollections ? largeCollectionsToExclude : []
    };

    let currentIndex = 0;
    for (const collectionName of collectionsToBackup) {
      currentIndex++;
      try {
        console.log(`📦 [Backup JSON] Đang export collection: ${collectionName}... (${currentIndex}/${collectionsToBackup.length})`);
        
        // ✅ Cập nhật progress
        if (onProgress) {
          onProgress({
            stage: 'exporting',
            current: currentIndex,
            total: collectionsToBackup.length,
            message: `Đang export collection: ${collectionName}`,
            percentage: Math.round((currentIndex / collectionsToBackup.length) * 60), // 60% cho export
            currentCollection: collectionName
          });
        }
        
        const collection = db.collection(collectionName);
        const documents = await collection.find({}).toArray();
        
        // Chuyển đổi ObjectId và các kiểu đặc biệt thành JSON-safe
        const jsonData = documents.map(doc => {
          const json = JSON.parse(JSON.stringify(doc));
          return json;
        });

        // Lưu ra file JSON
        const jsonFileName = `${collectionName}.json`;
        const jsonFilePath = path.join(tempDir, jsonFileName);
        await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');

        const stats = await fs.stat(jsonFilePath);
        const fileSize = stats.size;

        backupMetadata.collections.push({
          name: collectionName,
          documentCount: documents.length,
          fileSize: fileSize
        });
        backupMetadata.totalDocuments += documents.length;
        backupMetadata.totalSize += fileSize;

        console.log(`✅ [Backup JSON] Đã export ${collectionName}: ${documents.length} documents (${(fileSize / 1024).toFixed(2)} KB)`);
      } catch (error) {
        console.error(`❌ [Backup JSON] Lỗi khi export collection ${collectionName}:`, error.message);
        // Tiếp tục với collection tiếp theo
      }
    }

    // Lưu metadata
    const metadataPath = path.join(tempDir, '_metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(backupMetadata, null, 2), 'utf8');

    // ✅ Cập nhật progress - bắt đầu nén
    if (onProgress) {
      onProgress({
        stage: 'compressing',
        current: collectionsToBackup.length,
        total: collectionsToBackup.length,
        message: 'Đang nén các file JSON...',
        percentage: 70
      });
    }

    // Nén tất cả file JSON thành file .tar.gz
    console.log(`🔄 [Backup JSON] Đang nén các file JSON với compression level ${compressionLevel}...`);
    await compressDirectory(tempDir, backupFilePath, compressionLevel);

    // Xóa thư mục temp
    await fs.rm(tempDir, { recursive: true, force: true });

    // Lấy kích thước file
    const stats = await fs.stat(backupFilePath);
    const fileSize = stats.size;

    // ✅ Cập nhật progress - hoàn thành
    if (onProgress) {
      onProgress({
        stage: 'completed',
        current: collectionsToBackup.length,
        total: collectionsToBackup.length,
        message: 'Backup hoàn thành!',
        percentage: 100
      });
    }

    console.log(`✅ [Backup JSON] Tạo backup thành công: ${backupFileName}`);
    console.log(`   - Tổng số collections: ${backupMetadata.collections.length}`);
    console.log(`   - Tổng số documents: ${backupMetadata.totalDocuments}`);
    console.log(`   - Kích thước file: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Compression level: ${compressionLevel}`);
    if (excludeLargeCollections) {
      console.log(`   - Đã loại bỏ collections lớn: ${largeCollectionsToExclude.join(', ')}`);
    }

    return {
      filePath: backupFilePath,
      filename: backupFileName,
      fileSize,
      metadata: backupMetadata
    };
  } catch (error) {
    console.error('❌ [Backup JSON] Lỗi khi tạo backup:', error);
    throw error;
  }
}

/**
 * ✅ Restore backup từ file JSON
 * @param {string} backupFilePath - Đường dẫn file backup
 * @param {Object} options - Tùy chọn: collections (mảng tên collection), dropExisting
 */
async function restoreMongoBackupJSON(backupFilePath, options = {}) {
  try {
    const { collections = null, dropExisting = false } = options;
    
    console.log(`🔄 [Restore JSON] Bắt đầu restore từ file: ${backupFilePath}`);

    // Tạo thư mục temp để giải nén
    const tempDir = path.join(path.dirname(backupFilePath), `restore-json-temp-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Giải nén file .tar.gz
    console.log(`🔄 [Restore JSON] Đang giải nén backup...`);
    try {
      const tar = require('tar');
      await tar.extract({
        file: backupFilePath,
        cwd: tempDir,
      });
    } catch (error) {
      // Fallback: dùng tar command
      console.log('⚠️ [Restore JSON] Dùng tar command thay vì package tar');
      const tarCmd = process.platform === 'win32'
        ? `tar -xzf "${backupFilePath}" -C "${tempDir}"`
        : `tar -xzf "${backupFilePath}" -C "${tempDir}"`;
      await execAsync(tarCmd);
    }

    // Đọc metadata
    const metadataPath = path.join(tempDir, '_metadata.json');
    let metadata = null;
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metadataContent);
      console.log(`📋 [Restore JSON] Backup từ: ${metadata.timestamp}`);
      console.log(`📋 [Restore JSON] Số collections: ${metadata.collections.length}`);
    } catch (error) {
      console.warn('⚠️ [Restore JSON] Không tìm thấy metadata, sẽ restore tất cả file JSON');
    }

    // Lấy connection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection chưa được khởi tạo');
    }

    // Đọc tất cả file JSON trong thư mục temp
    const files = await fs.readdir(tempDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== '_metadata.json');

    // Lọc collections theo options
    let collectionsToRestore = jsonFiles.map(f => f.replace('.json', ''));
    if (collections && Array.isArray(collections) && collections.length > 0) {
      collectionsToRestore = collections.filter(c => jsonFiles.includes(`${c}.json`));
    }

    console.log(`📦 [Restore JSON] Sẽ restore ${collectionsToRestore.length} collections`);

    // Restore từng collection
    for (const collectionName of collectionsToRestore) {
      try {
        const jsonFilePath = path.join(tempDir, `${collectionName}.json`);
        const jsonContent = await fs.readFile(jsonFilePath, 'utf8');
        const documents = JSON.parse(jsonContent);

        if (!Array.isArray(documents) || documents.length === 0) {
          console.log(`⚠️ [Restore JSON] Collection ${collectionName} rỗng, bỏ qua`);
          continue;
        }

        const collection = db.collection(collectionName);

        // Xóa collection cũ nếu dropExisting = true
        if (dropExisting) {
          console.log(`🗑️ [Restore JSON] Đang xóa collection cũ: ${collectionName}...`);
          await collection.drop().catch(() => {
            // Collection có thể không tồn tại, không sao
          });
        }

        // Insert documents
        console.log(`📥 [Restore JSON] Đang restore collection: ${collectionName} (${documents.length} documents)...`);
        
        // Chia nhỏ thành batch để tránh memory issue
        const batchSize = 1000;
        for (let i = 0; i < documents.length; i += batchSize) {
          const batch = documents.slice(i, i + batchSize);
          await collection.insertMany(batch, { ordered: false });
        }

        console.log(`✅ [Restore JSON] Đã restore ${collectionName}: ${documents.length} documents`);
      } catch (error) {
        console.error(`❌ [Restore JSON] Lỗi khi restore collection ${collectionName}:`, error.message);
        // Tiếp tục với collection tiếp theo
      }
    }

    // Xóa thư mục temp
    await fs.rm(tempDir, { recursive: true, force: true });

    console.log(`✅ [Restore JSON] Restore backup thành công`);
  } catch (error) {
    console.error('❌ [Restore JSON] Lỗi khi restore backup:', error);
    throw error;
  }
}

module.exports = {
  createMongoBackup,
  createMongoBackupJSON,
  restoreMongoBackup,
  restoreMongoBackupJSON,
  cleanupOldBackups
};


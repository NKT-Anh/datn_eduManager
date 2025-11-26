/**
 * ✅ Script test Google Drive API
 * Kiểm tra quyền truy cập và upload thử
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const { uploadToGoogleDrive, createFolderOnGoogleDrive } = require('./src/utils/googleDriveHelper');

async function testGoogleDrive() {
  try {
    console.log('🔍 [Test] Bắt đầu kiểm tra Google Drive...\n');

    // 1. Kiểm tra credentials
    const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
    if (!credentials) {
      console.error('❌ GOOGLE_DRIVE_CREDENTIALS chưa được cấu hình trong .env');
      return;
    }
    console.log('✅ [Test] GOOGLE_DRIVE_CREDENTIALS đã được cấu hình');

    // 2. Kiểm tra folder ID
    const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
    if (!folderId) {
      console.log('⚠️ [Test] GOOGLE_DRIVE_BACKUP_FOLDER_ID chưa được cấu hình');
      console.log('📁 [Test] Đang tạo folder mới...');
      const newFolderId = await createFolderOnGoogleDrive('EduManage Backups');
      console.log(`✅ [Test] Đã tạo folder với ID: ${newFolderId}`);
      console.log(`ℹ️ [Test] Vui lòng thêm vào .env: GOOGLE_DRIVE_BACKUP_FOLDER_ID=${newFolderId}`);
      return;
    }
    console.log(`✅ [Test] Folder ID: ${folderId}`);

    // 3. Tạo file test
    const testFilePath = path.join(__dirname, 'test-backup.txt');
    const testContent = `Test backup file
Created at: ${new Date().toISOString()}
Service Account: apis-services@mongodb-backups-479314.iam.gserviceaccount.com
`;
    await fs.writeFile(testFilePath, testContent, 'utf8');
    console.log('✅ [Test] Đã tạo file test');

    // 4. Kiểm tra quyền truy cập folder trước
    console.log('🔍 [Test] Đang kiểm tra quyền truy cập folder...');
    try {
      const google = require('googleapis').google;
      const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
      let credentialsObj;
      if (credentials.startsWith('{')) {
        credentialsObj = JSON.parse(credentials);
      } else {
        const credPath = path.isAbsolute(credentials) 
          ? path.normalize(credentials.replace(/\\/g, '/'))
          : path.resolve(process.cwd(), credentials.replace(/\\/g, '/'));
        const credContent = await fs.readFile(credPath, 'utf8');
        credentialsObj = JSON.parse(credContent.replace(/^\uFEFF/, '').trim());
      }
      const auth = new google.auth.GoogleAuth({
        credentials: credentialsObj,
        scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'],
      });
      const drive = google.drive({ version: 'v3', auth });
      
      // Kiểm tra folder có tồn tại và có quyền truy cập không
      const folderInfo = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, permissions, shared, capabilities',
        supportsAllDrives: true,
      });
      
      console.log(`✅ [Test] Folder tồn tại: ${folderInfo.data.name}`);
      console.log(`   - Folder ID: ${folderInfo.data.id}`);
      console.log(`   - Shared: ${folderInfo.data.shared || false}`);
      console.log(`   - Permissions: ${folderInfo.data.permissions?.length || 0} người có quyền`);
      
      // Kiểm tra service account có trong permissions không
      const serviceAccountEmail = credentialsObj.client_email;
      const hasPermission = folderInfo.data.permissions?.some(
        p => p.emailAddress === serviceAccountEmail
      );
      
      if (hasPermission) {
        console.log(`✅ [Test] Service account có quyền truy cập folder`);
      } else {
        console.log(`⚠️ [Test] Service account CHƯA có quyền truy cập folder`);
        console.log(`💡 [Test] Vui lòng chia sẻ folder với email: ${serviceAccountEmail}`);
        console.log(`💡 [Test] Lưu ý: Service account không hiển thị trong danh sách "People" nhưng vẫn có quyền nếu được chia sẻ đúng`);
      }
    } catch (checkError) {
      console.warn(`⚠️ [Test] Không thể kiểm tra quyền: ${checkError.message}`);
    }

    // 5. Upload file test
    console.log('\n📤 [Test] Đang upload file test...');
    const fileName = `test-backup-${Date.now()}.txt`;
    const result = await uploadToGoogleDrive(testFilePath, fileName, folderId);
    
    console.log('\n✅ [Test] Upload thành công!');
    console.log(`   - File ID: ${result.fileId}`);
    console.log(`   - View Link: ${result.webViewLink}`);
    console.log(`   - Download Link: ${result.webContentLink}`);

    // 6. Xóa file test local
    await fs.unlink(testFilePath);
    console.log('✅ [Test] Đã xóa file test local');

    console.log('\n🎉 [Test] Tất cả kiểm tra đều thành công!');
    console.log('✅ Service account có quyền truy cập Google Drive');
    console.log('✅ Folder backup đã được cấu hình đúng');
    console.log('✅ Upload file hoạt động bình thường');

  } catch (error) {
    console.error('\n❌ [Test] Lỗi:', error.message);
    
    if (error.message.includes('File credentials')) {
      console.error('💡 Kiểm tra file credentials có tồn tại và hợp lệ không');
    } else if (error.message.includes('permission') || error.message.includes('403')) {
      console.error('💡 Service account chưa có quyền truy cập folder');
      console.error('💡 Vui lòng chia sẻ folder với email: apis-services@mongodb-backups-479314.iam.gserviceaccount.com');
    } else if (error.message.includes('404') || error.message.includes('not found')) {
      console.error('💡 Folder ID không tồn tại hoặc không đúng');
      console.error('💡 Kiểm tra lại GOOGLE_DRIVE_BACKUP_FOLDER_ID trong .env');
    } else {
      console.error('💡 Kiểm tra lại cấu hình Google Drive API');
    }
  }
}

// Chạy test
testGoogleDrive();


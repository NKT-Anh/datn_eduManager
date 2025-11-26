const fs = require('fs').promises;
const path = require('path');

// ✅ Lazy load googleapis để tránh lỗi nếu không cài đặt
let google = null;
function getGoogleApis() {
  if (!google) {
    try {
      google = require('googleapis').google;
    } catch (error) {
      throw new Error('googleapis chưa được cài đặt. Chạy: npm install googleapis');
    }
  }
  return google;
}

/**
 * ✅ Upload file lên Google Drive
 * @param {string} filePath - Đường dẫn file cần upload
 * @param {string} fileName - Tên file trên Drive
 * @param {string} folderId - ID thư mục trên Drive (optional)
 * @returns {Promise<{fileId: string, webViewLink: string}>}
 */
async function uploadToGoogleDrive(filePath, fileName, folderId = null) {
  try {
    // Lấy credentials từ environment
    const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
    if (!credentials) {
      throw new Error('GOOGLE_DRIVE_CREDENTIALS không được cấu hình trong .env');
    }

    console.log(`🔍 [Google Drive] Credentials path: ${credentials}`);

    const google = getGoogleApis();

    // Parse credentials (có thể là JSON string hoặc path to file)
    let credentialsObj;
    try {
      credentialsObj = JSON.parse(credentials);
    } catch (e) {
      // Nếu không phải JSON string, thử đọc từ file
      // Normalize path (hỗ trợ cả relative và absolute path)
      const credPath = path.isAbsolute(credentials) 
        ? path.normalize(credentials.replace(/\\/g, '/'))
        : path.resolve(process.cwd(), credentials.replace(/\\/g, '/'));
      
      console.log(`🔍 [Google Drive] Resolved credentials path: ${credPath}`);
      
      // Kiểm tra file có tồn tại không
      try {
        await fs.access(credPath);
        console.log(`✅ [Google Drive] File credentials tồn tại`);
      } catch (accessError) {
        console.error(`❌ [Google Drive] File credentials không tồn tại: ${credPath}`);
        throw new Error(`File credentials không tồn tại: ${credPath}`);
      }
      
      let credContent = await fs.readFile(credPath, 'utf8');
      
      // Loại bỏ BOM và whitespace thừa
      credContent = credContent.replace(/^\uFEFF/, '').trim();
      
      // Kiểm tra file có rỗng không
      if (!credContent || credContent.length === 0) {
        console.error(`❌ [Google Drive] File credentials rỗng: ${credPath}`);
        throw new Error(`File credentials rỗng: ${credPath}`);
      }
      
      console.log(`✅ [Google Drive] Đã đọc file credentials (${credContent.length} ký tự)`);
      
      try {
        credentialsObj = JSON.parse(credContent);
        console.log(`✅ [Google Drive] Đã parse JSON credentials thành công`);
        console.log(`✅ [Google Drive] Project ID: ${credentialsObj.project_id || 'N/A'}`);
        console.log(`✅ [Google Drive] Client Email: ${credentialsObj.client_email || 'N/A'}`);
      } catch (parseError) {
        console.error(`❌ [Google Drive] Lỗi parse JSON: ${parseError.message}`);
        console.error(`❌ [Google Drive] Nội dung file (200 ký tự đầu): ${credContent.substring(0, 200)}`);
        console.error(`❌ [Google Drive] Nội dung file (200 ký tự cuối): ${credContent.substring(Math.max(0, credContent.length - 200))}`);
        throw new Error(`File credentials không phải JSON hợp lệ: ${credPath}. Lỗi: ${parseError.message}`);
      }
    }

    // Khởi tạo OAuth2 client
    const auth = new google.auth.GoogleAuth({
      credentials: credentialsObj,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Đọc file
    const fileContent = await fs.readFile(filePath);
    const fileStats = await fs.stat(filePath);

    // Metadata cho file
    // ✅ Service Account cần upload vào Shared Drive hoặc folder được chia sẻ
    const fileMetadata = {
      name: fileName,
      ...(folderId && { parents: [folderId] }),
      // Thêm supportsAllDrives để hỗ trợ Shared Drive
      supportsAllDrives: true,
    };

    // Upload file
    console.log(`🔄 [Google Drive] Đang upload file: ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)...`);
    
    const media = {
      mimeType: 'application/gzip',
      body: require('fs').createReadStream(filePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true, // ✅ Hỗ trợ Shared Drive
    });

    console.log(`✅ [Google Drive] Upload thành công: ${response.data.id}`);

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
    };
  } catch (error) {
    console.error('❌ [Google Drive] Lỗi khi upload:', error);
    throw error;
  }
}

/**
 * ✅ Xóa file trên Google Drive
 * @param {string} fileId - ID file trên Drive
 */
async function deleteFromGoogleDrive(fileId) {
  try {
    const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
    if (!credentials) {
      throw new Error('GOOGLE_DRIVE_CREDENTIALS không được cấu hình');
    }

    const google = getGoogleApis();

    let credentialsObj;
    try {
      credentialsObj = JSON.parse(credentials);
    } catch (e) {
      // Normalize path (hỗ trợ cả relative và absolute path)
      const credPath = path.isAbsolute(credentials) 
        ? path.normalize(credentials.replace(/\\/g, '/'))
        : path.resolve(process.cwd(), credentials.replace(/\\/g, '/'));
      
      // Kiểm tra file có tồn tại không
      try {
        await fs.access(credPath);
      } catch (accessError) {
        throw new Error(`File credentials không tồn tại: ${credPath}`);
      }
      
      const credContent = await fs.readFile(credPath, 'utf8');
      
      // Kiểm tra file có rỗng không
      if (!credContent || credContent.trim().length === 0) {
        throw new Error(`File credentials rỗng: ${credPath}`);
      }
      
      try {
        credentialsObj = JSON.parse(credContent);
      } catch (parseError) {
        throw new Error(`File credentials không phải JSON hợp lệ: ${credPath}. Lỗi: ${parseError.message}`);
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials: credentialsObj,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    await drive.files.delete({ fileId });
    console.log(`✅ [Google Drive] Đã xóa file: ${fileId}`);
  } catch (error) {
    console.error('❌ [Google Drive] Lỗi khi xóa file:', error);
    throw error;
  }
}

/**
 * ✅ Tạo thư mục trên Google Drive
 * @param {string} folderName - Tên thư mục
 * @param {string} parentFolderId - ID thư mục cha (optional)
 * @returns {Promise<string>} - ID thư mục mới tạo
 */
async function createFolderOnGoogleDrive(folderName, parentFolderId = null) {
  try {
    const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
    if (!credentials) {
      throw new Error('GOOGLE_DRIVE_CREDENTIALS không được cấu hình');
    }

    const google = getGoogleApis();

    let credentialsObj;
    try {
      credentialsObj = JSON.parse(credentials);
    } catch (e) {
      // Normalize path (hỗ trợ cả relative và absolute path)
      const credPath = path.isAbsolute(credentials) 
        ? path.normalize(credentials.replace(/\\/g, '/'))
        : path.resolve(process.cwd(), credentials.replace(/\\/g, '/'));
      
      // Kiểm tra file có tồn tại không
      try {
        await fs.access(credPath);
      } catch (accessError) {
        throw new Error(`File credentials không tồn tại: ${credPath}`);
      }
      
      const credContent = await fs.readFile(credPath, 'utf8');
      
      // Kiểm tra file có rỗng không
      if (!credContent || credContent.trim().length === 0) {
        throw new Error(`File credentials rỗng: ${credPath}`);
      }
      
      try {
        credentialsObj = JSON.parse(credContent);
      } catch (parseError) {
        throw new Error(`File credentials không phải JSON hợp lệ: ${credPath}. Lỗi: ${parseError.message}`);
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials: credentialsObj,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId && { parents: [parentFolderId] }),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    return response.data.id;
  } catch (error) {
    console.error('❌ [Google Drive] Lỗi khi tạo thư mục:', error);
    throw error;
  }
}

module.exports = {
  uploadToGoogleDrive,
  deleteFromGoogleDrive,
  createFolderOnGoogleDrive,
};


const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

/**
 * ✅ Middleware upload cho backup files (.tar.gz)
 */
const backupUploadDir = process.env.BACKUP_DIR 
  ? path.normalize(process.env.BACKUP_DIR.replace(/\\/g, '/'))
  : path.join(process.cwd(), 'backups', 'uploads');

// Đảm bảo thư mục tồn tại
(async () => {
  try {
    await fs.mkdir(backupUploadDir, { recursive: true });
  } catch (error) {
    console.error('❌ [Backup Upload] Lỗi khi tạo thư mục upload:', error);
  }
})();

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      await fs.mkdir(backupUploadDir, { recursive: true });
      cb(null, backupUploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: function (req, file, cb) {
    // Giữ nguyên tên file gốc, thêm timestamp để tránh trùng
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `uploaded-${timestamp}-${base}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Chỉ cho phép file .tar.gz hoặc .gz
  const allowedExtensions = ['.tar.gz', '.gz', '.tar'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Kiểm tra extension
  if (file.originalname.toLowerCase().endsWith('.tar.gz') || 
      allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Chỉ chấp nhận file backup (.tar.gz, .gz, .tar)');
    error.code = 'UNSUPPORTED_FILE_TYPE';
    cb(error, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB max
  },
});

// Middleware xử lý lỗi
const uploadErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File quá lớn. Kích thước tối đa: 1GB',
        error: err.message 
      });
    }
    return res.status(400).json({ 
      message: `Lỗi upload file: ${err.message}`,
      error: err.message 
    });
  } else if (err?.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ 
      message: err.message,
      error: err.message 
    });
  } else if (err) {
    return res.status(500).json({ 
      message: 'Lỗi không xác định khi upload file',
      error: err.message 
    });
  }
  next();
};

module.exports = { upload, uploadErrorHandler };


const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 📁 Thư mục lưu file upload
const uploadDir = path.join(__dirname, "../uploads");

// Nếu thư mục chưa có thì tạo
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⚙️ Cấu hình nơi lưu file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // tạo tên file duy nhất: exam_1731000000000.xlsx
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}_${uniqueSuffix}${ext}`);
  },
});

// 🎯 Bộ lọc định dạng file hợp lệ
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "text/csv",
    "image/jpeg",
    "image/png",
    "application/pdf",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error("Định dạng file không được hỗ trợ.");
    error.code = "UNSUPPORTED_FILE_TYPE";
    return cb(error, false);
  }

  cb(null, true);
};

// 💾 Tạo instance upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// 🧩 Middleware xử lý lỗi khi upload
const uploadErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Lỗi của multer (ví dụ vượt dung lượng)
    return res.status(400).json({ error: `Lỗi upload file: ${err.message}` });
  } else if (err?.code === "UNSUPPORTED_FILE_TYPE") {
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(500).json({ error: "Lỗi không xác định khi upload file." });
  }
  next();
};

module.exports = upload;
module.exports.uploadErrorHandler = uploadErrorHandler;

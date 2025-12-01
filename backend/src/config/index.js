const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI;
    
    // ✅ Kiểm tra và sửa tên database nếu có chứa ký tự không hợp lệ
    if (mongoUri) {
      // Parse URI để kiểm tra tên database
      const uriMatch = mongoUri.match(/mongodb(\+srv)?:\/\/[^\/]+\/([^?]+)/);
      if (uriMatch) {
        const dbName = uriMatch[2];
        // MongoDB không cho phép: /, \, ., ", $, space trong tên database
        if (/[\/\\\.\"\$\s]/.test(dbName)) {
          const sanitizedDbName = dbName.replace(/[\/\\\.\"\$\s]/g, '_');
          // Thay thế tên database trong URI
          mongoUri = mongoUri.replace(`/${dbName}`, `/${sanitizedDbName}`);
          console.warn(`⚠️ Tên database chứa ký tự không hợp lệ, đã thay thế: "${dbName}" → "${sanitizedDbName}"`);
        }
      }
    }
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

module.exports = connectDB;

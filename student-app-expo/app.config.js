/**
 * Expo App Configuration
 * Đọc biến môi trường từ .env
 */

require('dotenv').config();

// ✅ CẤU HÌNH API URL
// Cách 1: Tạo file .env với: API_BASE_URL=http://YOUR_IP:3000/api
// Cách 2: Thay đổi giá trị dưới đây trực tiếp
// Để lấy IP: Windows: ipconfig | Mac/Linux: ifconfig
// Đã tự động detect IP: 192.168.2.225

const API_BASE_URL = process.env.API_BASE_URL || 'http://192.168.2.225:3000/api';

module.exports = {
  expo: {
    name: 'student-app-expo',
    slug: 'student-app-expo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    // ✅ Tắt New Architecture để tránh crash kiểu "String cannot be cast to Boolean" trên Android
    // (có thể bật lại sau khi ổn định)
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/logo_school_outline.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      usesCleartextTraffic: true,

    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      apiBaseUrl: API_BASE_URL,
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
    },
  },
};


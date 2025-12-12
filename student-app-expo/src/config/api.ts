/**
 * API Configuration
 */

import Constants from 'expo-constants';

// ✅ Lấy API URL từ app config hoặc environment variable
// Trong app.config.js, bạn có thể set extra.apiBaseUrl
// Hoặc tạo file .env với API_BASE_URL=http://YOUR_IP:3000/api
const getApiBaseUrl = () => {
  // Ưu tiên: Constants.expoConfig.extra.apiBaseUrl (từ app.config.js)
  if (Constants.expoConfig?.extra?.apiBaseUrl) {
    return Constants.expoConfig.extra.apiBaseUrl;
  }

  // Fallback: process.env.API_BASE_URL (từ .env)
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  // Default: localhost cho web, cần thay bằng IP cho mobile
  // ⚠️ LƯU Ý: Khi chạy trên Android/iOS, localhost KHÔNG hoạt động
  // Bạn CẦN thay localhost bằng IP của máy tính
  // Để lấy IP: Windows: ipconfig | Mac/Linux: ifconfig
  // Ví dụ: http://192.168.1.100:3000/api
  return __DEV__
    ? 'http://localhost:3000/api' // ⚠️ Thay localhost bằng IP khi chạy trên mobile
    : 'https://your-production-api.com/api';
};

const API_BASE_URL = getApiBaseUrl();

export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

export default apiConfig;


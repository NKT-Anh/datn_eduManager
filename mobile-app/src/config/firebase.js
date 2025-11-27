/**
 * Firebase Configuration
 * 
 * Lưu ý: 
 * - React Native Firebase tự động đọc config từ google-services.json (Android) 
 *   và GoogleService-Info.plist (iOS)
 * - Các giá trị trong .env chỉ để tham khảo hoặc dùng cho web SDK
 * - Để sử dụng Firebase trong React Native, cần cấu hình native files
 * 
 * Import the functions you need from the SDKs you need
 */

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import analytics from '@react-native-firebase/analytics';
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
  FIREBASE_DATABASE_URL,
} from '@env';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Note: This config is mainly for reference. React Native Firebase uses native config files
const firebaseConfig = {
  apiKey: FIREBASE_API_KEY || 'AIzaSyAwmRsktLxuPE-LoL2K0_jwyKFZkPusAec',
  authDomain: FIREBASE_AUTH_DOMAIN || 'eduschool-206f0.firebaseapp.com',
  projectId: FIREBASE_PROJECT_ID || 'eduschool-206f0',
  storageBucket: FIREBASE_STORAGE_BUCKET || 'eduschool-206f0.firebasestorage.app',
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID || '661437018200',
  appId: FIREBASE_APP_ID || '1:661437018200:web:e6e0b06256382840f31a2d',
  measurementId: FIREBASE_MEASUREMENT_ID || 'G-T031SPTS6P',
  // Android specific
  ...(FIREBASE_DATABASE_URL && {databaseURL: FIREBASE_DATABASE_URL}),
};

// Initialize Analytics
// React Native Firebase automatically initializes from native config
let analyticsInstance;
try {
  if (!__DEV__) {
    // Only initialize analytics in production
    analyticsInstance = analytics();
  }
} catch (error) {
  console.log('Analytics initialization error:', error);
}

// Export Firebase services
// Note: React Native Firebase doesn't need explicit initialization
// It reads config from google-services.json (Android) and GoogleService-Info.plist (iOS)
export {auth, firestore, analytics, analyticsInstance};
export {firebaseConfig};
export default firebaseConfig;


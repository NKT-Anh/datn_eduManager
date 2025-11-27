/**
 * Firebase Web SDK Configuration
 * 
 * Sử dụng cho web hoặc nếu cần dùng Firebase Web SDK
 * Import the functions you need from the SDKs you need
 */

import {initializeApp} from 'firebase/app';
import {getAnalytics} from 'firebase/analytics';
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
} from '@env';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: FIREBASE_API_KEY || 'AIzaSyAwmRsktLxuPE-LoL2K0_jwyKFZkPusAec',
  authDomain: FIREBASE_AUTH_DOMAIN || 'eduschool-206f0.firebaseapp.com',
  projectId: FIREBASE_PROJECT_ID || 'eduschool-206f0',
  storageBucket: FIREBASE_STORAGE_BUCKET || 'eduschool-206f0.firebasestorage.app',
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID || '661437018200',
  appId: FIREBASE_APP_ID || '1:661437018200:web:e6e0b06256382840f31a2d',
  measurementId: FIREBASE_MEASUREMENT_ID || 'G-T031SPTS6P',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
let analyticsInstance = null;
if (typeof window !== 'undefined') {
  try {
    analyticsInstance = getAnalytics(app);
  } catch (error) {
    console.log('Analytics initialization error:', error);
  }
}

export {app, analyticsInstance, firebaseConfig};
export default app;


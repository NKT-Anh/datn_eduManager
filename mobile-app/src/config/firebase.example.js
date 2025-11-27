/**
 * Firebase Configuration Example
 * 
 * Copy this file to firebase.js and fill in your Firebase project credentials
 * 
 * Để lấy thông tin Firebase:
 * 1. Vào Firebase Console: https://console.firebase.google.com/
 * 2. Chọn project của bạn
 * 3. Vào Project Settings (⚙️)
 * 4. Scroll xuống phần "Your apps"
 * 5. Chọn hoặc tạo Android/iOS app
 * 6. Copy các giá trị config
 */

import {initializeApp} from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  authDomain: 'your-project-id.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project-id.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:android:abcdef1234567890',
  // Android specific
  // databaseURL: 'https://your-project-id.firebaseio.com',
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.log('Firebase already initialized or error:', error);
}

// Export Firebase services
export {auth, firestore};
export default app;


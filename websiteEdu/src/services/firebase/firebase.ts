// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAwmRsktLxuPE-LoL2K0_jwyKFZkPusAec",
  authDomain: "eduschool-206f0.firebaseapp.com",
  projectId: "eduschool-206f0",
  storageBucket: "eduschool-206f0.firebasestorage.app",
  messagingSenderId: "661437018200",
  appId: "1:661437018200:web:e6e0b06256382840f31a2d",
  measurementId: "G-T031SPTS6P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
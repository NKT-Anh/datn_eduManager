# Hướng dẫn Setup Firebase cho Mobile App

## Bước 1: Tạo Firebase Project

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Thêm Android app:
   - Package name: `com.edumanagermobile` (hoặc tên bạn muốn)
   - Download `google-services.json`
4. Thêm iOS app (nếu cần):
   - Bundle ID: `com.edumanagermobile` (hoặc tên bạn muốn)
   - Download `GoogleService-Info.plist`

## Bước 2: Cài đặt Firebase SDK

```bash
cd mobile-app
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
```

### Android Setup

1. Copy `google-services.json` vào `android/app/`
2. Thêm vào `android/build.gradle`:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

3. Thêm vào `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### iOS Setup (chỉ trên macOS)

1. Copy `GoogleService-Info.plist` vào `ios/` folder
2. Mở Xcode và add file vào project
3. Cài đặt CocoaPods:
```bash
cd ios
pod install
```

## Bước 3: Cấu hình Firebase

1. Copy file `src/config/firebase.example.js` thành `src/config/firebase.js`
2. Điền thông tin Firebase config từ Firebase Console:
   - Vào Project Settings > Your apps
   - Copy các giá trị config

## Bước 4: Cấu hình Backend

Backend cần có endpoint `/api/auth/firebase` để xác thực Firebase token:

```javascript
// Backend endpoint example
router.post('/auth/firebase', async (req, res) => {
  const { firebaseToken, firebaseUid } = req.body;
  
  // Verify Firebase token
  const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
  
  // Find or create user in database
  let user = await User.findOne({ firebaseUid: decodedToken.uid });
  
  if (!user) {
    // Create new user from Firebase
    user = await User.create({
      firebaseUid: decodedToken.uid,
      phone: decodedToken.phone_number,
      email: decodedToken.email,
      // ... other fields
    });
  }
  
  // Generate backend JWT token
  const token = generateJWT(user);
  
  res.json({
    success: true,
    data: {
      token,
      user
    }
  });
});
```

## Bước 5: Test Authentication

1. Chạy app: `npm run android` hoặc `npm run ios`
2. Test đăng nhập bằng email/password hoặc số điện thoại

## Lưu ý

- Đảm bảo Firebase Authentication đã được enable trong Firebase Console
- Phone Authentication cần cấu hình trong Firebase Console
- Email/Password Authentication cần được enable
- Backend phải có Firebase Admin SDK để verify token


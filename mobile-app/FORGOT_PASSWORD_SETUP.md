# Hướng dẫn Setup Quên Mật Khẩu qua SMS

## Tổng quan

Màn hình quên mật khẩu sử dụng Firebase Phone Authentication để gửi OTP qua SMS. Quy trình gồm 3 bước:

1. **Nhập số điện thoại** - Người dùng nhập số điện thoại đã đăng ký
2. **Xác thực OTP** - Firebase gửi OTP qua SMS, người dùng nhập mã để xác thực
3. **Đặt lại mật khẩu** - Sau khi xác thực thành công, người dùng nhập mật khẩu mới

## Backend Setup

### 1. Endpoints đã tạo

- `POST /api/auth/forgot-password` - Gửi OTP qua SMS
- `POST /api/auth/reset-password` - Đặt lại mật khẩu sau khi xác thực OTP

### 2. Cấu hình Firebase Phone Authentication

Firebase Phone Authentication cần được cấu hình trong Firebase Console:

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project của bạn
3. Vào **Authentication** → **Sign-in method**
4. Bật **Phone** authentication
5. Cấu hình reCAPTCHA (cho Android) hoặc App Check (cho iOS)

## Mobile App Setup

### 1. Cấu hình Firebase cho React Native

#### Android:
1. Tải file `google-services.json` từ Firebase Console
2. Đặt vào `android/app/google-services.json`
3. Cấu hình trong `android/build.gradle`:
   ```gradle
   dependencies {
       classpath 'com.google.gms:google-services:4.4.0'
   }
   ```
4. Cấu hình trong `android/app/build.gradle`:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

#### iOS:
1. Tải file `GoogleService-Info.plist` từ Firebase Console
2. Đặt vào `ios/GoogleService-Info.plist`
3. Cấu hình trong Xcode:
   - Mở project trong Xcode
   - Kéo `GoogleService-Info.plist` vào project
   - Đảm bảo "Copy items if needed" được chọn

### 2. Cấu hình quyền

#### Android (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
```

#### iOS (`ios/Info.plist`):
```xml
<key>NSPhoneNumberUsageDescription</key>
<string>Chúng tôi cần quyền truy cập số điện thoại để gửi mã OTP</string>
```

## Sử dụng

### 1. Từ màn hình Login

Người dùng click vào "Quên mật khẩu?" để chuyển đến màn hình `ForgotPasswordScreen`.

### 2. Quy trình

1. **Nhập số điện thoại**: 
   - Người dùng nhập số điện thoại (VD: 0912345678)
   - Hệ thống tự động format thành +84912345678
   - Backend kiểm tra số điện thoại có tồn tại không

2. **Gửi OTP**:
   - Firebase tự động gửi OTP qua SMS
   - Người dùng nhận mã OTP (6 số)

3. **Xác thực OTP**:
   - Người dùng nhập mã OTP
   - Firebase xác thực mã
   - Nếu đúng, chuyển sang bước đặt mật khẩu mới

4. **Đặt lại mật khẩu**:
   - Người dùng nhập mật khẩu mới (tối thiểu 6 ký tự)
   - Xác nhận mật khẩu
   - Backend cập nhật mật khẩu trong Firebase
   - Chuyển về màn hình Login

## Lưu ý

1. **Firebase Phone Authentication**:
   - Cần có số điện thoại thật để test
   - Firebase có giới hạn số lượng OTP gửi trong ngày
   - Trong development, có thể dùng số điện thoại test

2. **Bảo mật**:
   - OTP có thời gian hết hạn (thường là 5-10 phút)
   - Mỗi số điện thoại chỉ có thể yêu cầu OTP một số lần nhất định trong ngày
   - Backend kiểm tra số điện thoại có tồn tại trước khi gửi OTP

3. **Error Handling**:
   - Nếu số điện thoại không tồn tại → Hiển thị lỗi
   - Nếu OTP sai → Cho phép nhập lại hoặc gửi lại OTP
   - Nếu OTP hết hạn → Yêu cầu gửi lại OTP

## Troubleshooting

### Lỗi: "Phone number format is invalid"
- Đảm bảo số điện thoại được format đúng (bắt đầu bằng +84)
- Kiểm tra số điện thoại có đúng 10-11 số không

### Lỗi: "SMS quota exceeded"
- Firebase có giới hạn số lượng SMS trong ngày
- Đợi đến ngày hôm sau hoặc nâng cấp Firebase plan

### Lỗi: "reCAPTCHA verification failed" (Android)
- Cần cấu hình reCAPTCHA trong Firebase Console
- Hoặc sử dụng App Check cho iOS

### OTP không đến
- Kiểm tra số điện thoại có đúng không
- Kiểm tra kết nối mạng
- Kiểm tra Firebase Console có bật Phone Authentication không

## Tài liệu tham khảo

- [Firebase Phone Authentication](https://firebase.google.com/docs/auth/web/phone-auth)
- [React Native Firebase Auth](https://rnfirebase.io/auth/phone-auth)
- [Firebase Console](https://console.firebase.google.com/)


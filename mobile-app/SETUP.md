# Hướng dẫn Setup React Native Project

## Bước 1: Cài đặt dependencies

```bash
cd mobile-app
npm install
```

## Bước 2: Tạo cấu trúc Android và iOS

Sau khi cài đặt dependencies, bạn cần tạo các folder native:

### Cách 1: Sử dụng React Native CLI (Khuyến nghị)

```bash
# Tạo project mới trong folder tạm
npx react-native@latest init TempProject

# Copy các folder android và ios
cp -r TempProject/android .
cp -r TempProject/ios .
rm -rf TempProject
```

### Cách 2: Sử dụng template

```bash
npx react-native@latest init EduManagerMobile --template react-native-template-typescript
```

Sau đó copy các file cấu hình từ project mới vào project hiện tại.

## Bước 3: Cấu hình Android

1. Mở Android Studio
2. Mở folder `android` trong project
3. Đợi Gradle sync hoàn tất
4. Cấu hình Android SDK nếu cần

## Bước 4: Cấu hình iOS (chỉ trên macOS)

1. Mở Xcode
2. Mở file `ios/EduManagerMobile.xcworkspace`
3. Chọn simulator hoặc device
4. Cấu hình signing nếu cần

## Bước 5: Chạy ứng dụng

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

## Lưu ý

- Đảm bảo đã cài đặt Android Studio và Xcode (nếu dùng iOS)
- Đảm bảo đã cài đặt Java Development Kit (JDK) cho Android
- Kiểm tra kết nối với backend API


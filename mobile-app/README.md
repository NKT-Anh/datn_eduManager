# EduManager Mobile

Ứng dụng mobile cho hệ thống quản lý trường học THPT.

## Cài đặt

### Yêu cầu
- Node.js >= 18
- React Native CLI
- Android Studio (cho Android)
- Xcode (cho iOS - chỉ trên macOS)

### Cài đặt dependencies

```bash
npm install
# hoặc
yarn install
```

### Chạy ứng dụng

#### Android
```bash
npm run android
# hoặc
yarn android
```

#### iOS
```bash
npm run ios
# hoặc
yarn ios
```

### Chạy Metro bundler
```bash
npm start
# hoặc
yarn start
```

## Cấu trúc thư mục

```
mobile-app/
├── App.tsx          # Component chính
├── index.js         # Entry point
├── package.json     # Dependencies
└── ...
```

## Liên kết với Backend

Ứng dụng sẽ kết nối với backend tại: `http://localhost:3000` (hoặc URL backend của bạn)


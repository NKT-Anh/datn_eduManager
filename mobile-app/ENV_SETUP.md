# Hướng dẫn cấu hình Environment Variables

## Bước 1: Cài đặt dependencies

```bash
cd mobile-app
npm install
```

## Bước 2: Tạo file .env

1. Copy file `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```

2. Hoặc tạo file `.env` mới và copy nội dung từ `.env.example`

## Bước 3: Điền thông tin vào file .env

Mở file `.env` và thay thế các giá trị:

### API Configuration
```env
API_BASE_URL_DEV=http://localhost:3000/api
API_BASE_URL_PROD=https://your-production-api.com/api
```

### Firebase Configuration
Lấy thông tin từ Firebase Console:
1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project của bạn
3. Vào Project Settings (⚙️)
4. Scroll xuống phần "Your apps"
5. Copy các giá trị config

```env
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:android:abcdef1234567890
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
```

### MongoDB Configuration
Lấy connection string từ MongoDB Atlas:
1. Vào [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Chọn cluster của bạn
3. Click "Connect" → "Connect your application"
4. Copy connection string

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/eduManager?retryWrites=true&w=majority
```

### Cloudinary Configuration
Lấy thông tin từ Cloudinary Dashboard:
1. Vào [Cloudinary Console](https://console.cloudinary.com/)
2. Vào Settings → Upload
3. Copy các giá trị

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_UPLOAD_PRESET=your-upload-preset
```

### App Configuration
```env
APP_NAME=EduManager Mobile
APP_VERSION=0.0.1
```

## Bước 4: Sử dụng trong code

### Import environment variables:
```typescript
import {API_BASE_URL_DEV, FIREBASE_API_KEY} from '@env';
```

### Ví dụ sử dụng:
```typescript
// In services/api.ts
import {API_BASE_URL_DEV, API_BASE_URL_PROD} from '@env';

const API_BASE_URL = __DEV__ ? API_BASE_URL_DEV : API_BASE_URL_PROD;
```

## Lưu ý quan trọng

1. **KHÔNG commit file `.env` vào Git**
   - File `.env` đã được thêm vào `.gitignore`
   - Chỉ commit file `.env.example`

2. **Restart Metro bundler sau khi thay đổi .env**
   ```bash
   npm start -- --reset-cache
   ```

3. **Rebuild app sau khi thay đổi .env**
   ```bash
   # Android
   npm run android
   
   # iOS
   npm run ios
   ```

4. **Kiểm tra TypeScript types**
   - File `src/types/env.d.ts` định nghĩa types cho các biến môi trường
   - Nếu thêm biến mới, cần cập nhật file này

## Troubleshooting

### Lỗi: "Cannot find module '@env'"
- Đảm bảo đã cài đặt `react-native-dotenv`
- Kiểm tra `babel.config.js` đã có plugin `module:react-native-dotenv`
- Restart Metro bundler

### Lỗi: "Environment variable is undefined"
- Kiểm tra file `.env` có tồn tại không
- Kiểm tra tên biến trong `.env` có đúng không
- Restart Metro bundler và rebuild app

### Lỗi TypeScript
- Kiểm tra file `src/types/env.d.ts` đã có type definition chưa
- Thêm type definition cho biến mới nếu cần


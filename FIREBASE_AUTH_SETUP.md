# 🔥 Hướng dẫn cấu hình Firebase Authentication

## 📱 1. Bật Phone Authentication (SMS OTP)

### ⚠️ LƯU Ý QUAN TRỌNG:
- Firebase Phone Authentication **YÊU CẦU BẬT BILLING** (Blaze plan)
- Nếu không bật billing, sẽ gặp lỗi: `auth/billing-not-enabled`
- **Giải pháp tạm thời**: Sử dụng Email OTP thay vì SMS

### Bước 1: Bật Billing (BẮT BUỘC)
1. Truy cập: https://console.firebase.google.com/
2. Chọn project: `eduschool-206f0`
3. Vào **⚙️ Project Settings** → **Usage and billing**
4. Click **Modify plan** → Chọn **Blaze (Pay as you go)**
5. Thêm phương thức thanh toán (thẻ tín dụng)
6. **Lưu ý**: Firebase có free tier cho Phone Auth (10,000 SMS/tháng miễn phí)

### Bước 2: Vào Firebase Console
1. Truy cập: https://console.firebase.google.com/
2. Chọn project của bạn: `eduschool-206f0`

### Bước 3: Bật Phone Authentication
1. Vào **Authentication** → **Sign-in method**
2. Tìm **Phone** trong danh sách providers
3. Click vào **Phone** → Bật **Enable**
4. Click **Save**

### Bước 4: Cấu hình reCAPTCHA (nếu cần)
- Firebase sẽ tự động tạo reCAPTCHA cho web
- Đảm bảo domain của bạn đã được thêm vào **Authorized domains**

### Bước 5: Test Phone Auth
- Sử dụng số điện thoại test trong Firebase Console (nếu có)
- Hoặc sử dụng số điện thoại thật (sẽ tốn phí SMS sau free tier)

### 🔄 Giải pháp thay thế (KHÔNG CẦN BILLING):
Nếu không muốn bật billing, hệ thống đã hỗ trợ **Email OTP**:
- Người dùng có thể chọn tab **Email** thay vì **Số điện thoại**
- OTP sẽ được gửi qua email (sử dụng SMTP đã cấu hình)
- Không cần Firebase Phone Auth

---

## 🔐 2. Bật Google Sign-In

### Bước 1: Vào Firebase Console
1. Truy cập: https://console.firebase.google.com/
2. Chọn project: `eduschool-206f0`

### Bước 2: Bật Google Provider
1. Vào **Authentication** → **Sign-in method**
2. Tìm **Google** trong danh sách providers
3. Click vào **Google** → Bật **Enable**
4. Nhập **Project support email** (email của bạn)
5. Click **Save**

### Bước 3: Lấy OAuth Client ID (cho Web)
1. Vào **Project Settings** (⚙️) → **General**
2. Scroll xuống phần **Your apps**
3. Chọn app **Web** (hoặc tạo mới nếu chưa có)
4. Copy **Web API Key** và **OAuth client ID** (nếu có)

### Bước 4: Cấu hình OAuth Consent Screen (Google Cloud Console)
1. Truy cập: https://console.cloud.google.com/
2. Chọn project: `eduschool-206f0`
3. Vào **APIs & Services** → **OAuth consent screen**
4. Chọn **External** (hoặc Internal nếu dùng Google Workspace)
5. Điền thông tin:
   - **App name**: EduManager
   - **User support email**: Email của bạn
   - **Developer contact information**: Email của bạn
6. Click **Save and Continue**
7. Thêm **Scopes** (nếu cần):
   - `email`
   - `profile`
   - `openid`
8. Click **Save and Continue**
9. Thêm **Test users** (nếu ở chế độ Testing)
10. Click **Save and Continue** → **Back to Dashboard**

### Bước 5: Tạo OAuth 2.0 Client ID
1. Vào **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Chọn **Application type**: **Web application**
4. Đặt tên: `EduManager Web Client`
5. Thêm **Authorized JavaScript origins**:
   - `http://localhost:3001`
   - `http://localhost:8080`
   - `http://localhost:8081`
   - Domain production của bạn (nếu có)
6. Thêm **Authorized redirect URIs**:
   - `http://localhost:3001`
   - `http://localhost:8080`
   - `http://localhost:8081`
   - Domain production của bạn (nếu có)
7. Click **Create**
8. Copy **Client ID** và **Client secret** (lưu lại để dùng)

---

## 📝 3. Cập nhật code để sử dụng Google Sign-In

### Frontend (React/TypeScript):

```typescript
// src/services/firebase/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAwmRsktLxuPE-LoL2K0_jwyKFZkPusAec",
  authDomain: "eduschool-206f0.firebaseapp.com",
  projectId: "eduschool-206f0",
  storageBucket: "eduschool-206f0.firebasestorage.app",
  messagingSenderId: "661437018200",
  appId: "1:661437018200:web:e6e0b06256382840f31a2d",
  measurementId: "G-T031SPTS6P"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
```

### Sử dụng Google Sign-In:

```typescript
import { signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, googleProvider } from "@/services/firebase/firebase";

// Cách 1: Popup (khuyến nghị cho desktop)
const handleGoogleSignIn = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    
    // Gửi idToken lên backend để xác thực
    const response = await api.post('/auth/login', {
      idToken: idToken
    });
    
    // Xử lý response từ backend
  } catch (error) {
    console.error('Google Sign-In error:', error);
  }
};

// Cách 2: Redirect (khuyến nghị cho mobile)
const handleGoogleSignInRedirect = async () => {
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('Google Sign-In Redirect error:', error);
  }
};
```

---

## 🔧 4. Troubleshooting

### Lỗi: `auth/operation-not-allowed`
- **Nguyên nhân**: Provider chưa được bật trong Firebase Console
- **Giải pháp**: 
  1. Vào Firebase Console → Authentication → Sign-in method
  2. Bật provider tương ứng (Phone hoặc Google)

### Lỗi: `auth/unauthorized-domain`
- **Nguyên nhân**: Domain chưa được thêm vào Authorized domains
- **Giải pháp**:
  1. Vào Firebase Console → Authentication → Settings
  2. Thêm domain vào **Authorized domains**

### Lỗi: `auth/invalid-api-key`
- **Nguyên nhân**: API key không đúng hoặc đã bị vô hiệu hóa
- **Giải pháp**: Kiểm tra lại API key trong Firebase Console

### Lỗi: OAuth consent screen chưa được cấu hình
- **Nguyên nhân**: Chưa setup OAuth consent screen trong Google Cloud Console
- **Giải pháp**: Làm theo Bước 4 ở trên

---

## 📚 Tài liệu tham khảo

- Firebase Phone Auth: https://firebase.google.com/docs/auth/web/phone-auth
- Firebase Google Auth: https://firebase.google.com/docs/auth/web/google-signin
- Google OAuth Setup: https://developers.google.com/identity/protocols/oauth2

---

## ✅ Checklist

- [ ] Bật Phone Authentication trong Firebase Console
- [ ] Bật Google Sign-In trong Firebase Console
- [ ] Cấu hình OAuth Consent Screen
- [ ] Tạo OAuth Client ID
- [ ] Thêm Authorized domains
- [ ] Cập nhật code frontend
- [ ] Test Phone Auth
- [ ] Test Google Sign-In


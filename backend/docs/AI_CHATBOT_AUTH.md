# 🔐 Xác thực và Phân quyền cho AI Chatbot

## 📋 Tổng quan

AI Chatbot được bảo vệ bởi 2 lớp middleware:
1. **Firebase Authentication** - Xác thực người dùng qua Firebase token
2. **Role Validation** - Kiểm tra role được phép sử dụng chatbot

## ✅ Middleware Stack

### 1. `authMiddleware` - Firebase Authentication

**File:** `backend/src/middlewares/authMiddleware.js`

**Chức năng:**
- ✅ Xác thực Firebase ID token từ header `Authorization: Bearer <token>`
- ✅ Verify token với Firebase Admin SDK
- ✅ Kiểm tra account tồn tại trong MongoDB
- ✅ Kiểm tra tài khoản có bị khóa không
- ✅ Lấy thông tin user (role, accountId, email, phone)
- ✅ Lấy teacherFlags cho giáo viên (isLeader, isHomeroom, isDepartmentHead)

**Request sau khi qua middleware:**
```javascript
req.user = {
  uid: 'firebase-uid',
  accountId: ObjectId,
  role: 'student' | 'teacher' | 'admin',
  email: 'user@example.com',
  phone: '0123456789',
  teacherFlags: { // Chỉ có nếu là teacher
    isLeader: boolean,
    isHomeroom: boolean,
    isDepartmentHead: boolean,
    currentHomeroomClassId: ObjectId | null
  }
}
```

**Lỗi có thể trả về:**
- `401` - Không có token hoặc token không hợp lệ
- `403` - Tài khoản bị khóa
- `401` - Token đã hết hạn

### 2. `validateChatbotRole` - Role Validation

**File:** `backend/src/routes/aiChatRoutes.js`

**Chức năng:**
- ✅ Kiểm tra user đã được xác thực chưa
- ✅ Validate role được phép sử dụng chatbot:
  - ✅ `student` - Học sinh
  - ✅ `teacher` - Giáo viên (bao gồm gvbm, gvcn, qlbm, bgh)
  - ✅ `admin` - Quản trị viên
- ✅ Double-check tài khoản có bị khóa không

**Lỗi có thể trả về:**
- `401` - Chưa xác thực
- `403` - Role không được phép sử dụng chatbot
- `403` - Tài khoản bị khóa

## 🔄 Flow xử lý request

```
Client Request
    ↓
[1] authMiddleware
    ├─ Kiểm tra Authorization header
    ├─ Verify Firebase token
    ├─ Lấy account từ MongoDB
    ├─ Kiểm tra account bị khóa
    ├─ Lấy role và teacherFlags
    └─ Gắn req.user
    ↓
[2] validateChatbotRole
    ├─ Kiểm tra req.user tồn tại
    ├─ Validate role (student/teacher/admin)
    └─ Kiểm tra account bị khóa (double-check)
    ↓
[3] aiChatController.chat
    ├─ Xử lý câu hỏi
    ├─ Phân loại theo role
    └─ Trả về response
```

## 📝 Route Configuration

**File:** `backend/src/routes/aiChatRoutes.js`

```javascript
router.post('/chat', 
  authMiddleware,        // ✅ Firebase Auth
  validateChatbotRole,  // ✅ Role Validation
  aiChatController.chat // ✅ Controller
);
```

## 🔒 Security Features

### 1. Firebase Token Verification
- ✅ Token được verify với Firebase Admin SDK
- ✅ Kiểm tra token format (Bearer token)
- ✅ Kiểm tra token độ dài (tối thiểu 50 ký tự)
- ✅ Xử lý các lỗi Firebase (expired, invalid, network)

### 2. Account Validation
- ✅ Kiểm tra account tồn tại trong MongoDB
- ✅ Kiểm tra tài khoản bị khóa (`isLocked`)
- ✅ Trả về thông tin chi tiết khi bị khóa (lockedAt, lockReason)

### 3. Role-Based Access Control
- ✅ Chỉ cho phép các role: `student`, `teacher`, `admin`
- ✅ Từ chối các role khác (parent, guest, etc.)
- ✅ Log chi tiết khi role không được phép

### 4. Teacher Flags Support
- ✅ Hỗ trợ teacher flags (isLeader, isHomeroom, isDepartmentHead)
- ✅ Flags được lấy theo năm học hiện tại
- ✅ BGH (isLeader) được set cứng ở top-level

## 📊 Response Format

### Success Response
```json
{
  "text": "Câu trả lời từ chatbot",
  "type": "text",
  "action": "navigate", // Optional
  "data": {             // Optional
    "path": "/gvbm/grades"
  }
}
```

### Error Response
```json
{
  "message": "Thông báo lỗi",
  "code": "error-code",
  "hint": "Gợi ý khắc phục" // Optional
}
```

## 🧪 Testing

### Test với Firebase token hợp lệ:
```bash
curl -X POST http://localhost:5000/api/ai-chat/chat \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Xin chào"}'
```

### Test với token không hợp lệ:
```bash
curl -X POST http://localhost:5000/api/ai-chat/chat \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"message": "Xin chào"}'
```

### Test với role không được phép:
- Tạo account với role `parent` hoặc `guest`
- Gửi request với token của account đó
- Kỳ vọng: `403 - Role không được phép`

## 📌 Notes

1. **Firebase Token Expiry**: Token Firebase có thời hạn, client cần refresh token khi hết hạn
2. **Account Locking**: Tài khoản bị khóa sẽ không thể sử dụng chatbot
3. **Role Validation**: Chỉ `student`, `teacher`, `admin` mới được phép
4. **Teacher Flags**: Flags được lấy theo năm học hiện tại (effectiveYear)
5. **BGH Access**: BGH (isLeader) luôn có quyền truy cập, không phụ thuộc vào năm học

## 🔄 Future Improvements

- [ ] Thêm rate limiting cho chatbot
- [ ] Thêm logging chi tiết cho mỗi request
- [ ] Thêm caching cho các câu hỏi thường gặp
- [ ] Thêm analytics để theo dõi usage


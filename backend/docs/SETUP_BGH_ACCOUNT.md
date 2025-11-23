# 🏛️ Hướng dẫn thiết lập tài khoản Ban Giám Hiệu (BGH)

## 📋 Yêu cầu

1. Đã có tài khoản Admin để set flag
2. Đã có Teacher trong hệ thống (hoặc tạo mới)
3. Teacher đã có Account (đã link với Firebase)

## 🔧 Cách 1: Sử dụng API (Khuyến nghị)

### Bước 1: Tìm Teacher ID

1. Login với tài khoản Admin
2. Vào trang `/admin/teachers`
3. Tìm teacher cần set làm BGH
4. Lấy `_id` của teacher (có thể xem trong URL hoặc inspect element)

Hoặc sử dụng API:
```bash
GET /api/teachers
Authorization: Bearer <admin_token>
```

### Bước 2: Set flag isLeader

Sử dụng API để set flag:
```bash
PUT /api/accounts/teacher/:teacherId/flags
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "isLeader": true
}
```

Ví dụ với curl:
```bash
curl -X PUT http://localhost:3000/api/accounts/teacher/<TEACHER_ID>/flags \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"isLeader": true}'
```

### Bước 3: Kiểm tra

1. Logout và login lại với tài khoản teacher đó
2. Kiểm tra xem có redirect đến `/bgh/home` không
3. Kiểm tra sidebar có hiển thị menu BGH không

## 🔧 Cách 2: Sử dụng MongoDB trực tiếp

Nếu bạn có quyền truy cập MongoDB:

```javascript
// Kết nối MongoDB
use your_database_name

// Tìm teacher theo tên hoặc email
db.teachers.findOne({ name: "Tên Giáo Viên" })

// Set flag isLeader
db.teachers.updateOne(
  { _id: ObjectId("TEACHER_ID") },
  { $set: { isLeader: true } }
)
```

## 🔧 Cách 3: Sử dụng Admin Panel (Nếu có)

1. Login với tài khoản Admin
2. Vào trang quản lý giáo viên
3. Tìm teacher cần set
4. Click "Sửa" hoặc "Cập nhật quyền"
5. Check vào "Ban Giám Hiệu" hoặc set `isLeader = true`
6. Lưu

## ✅ Kiểm tra sau khi setup

1. **Kiểm tra Teacher model:**
   ```javascript
   db.teachers.findOne({ _id: ObjectId("TEACHER_ID") })
   // Kiểm tra: isLeader: true
   ```

2. **Kiểm tra Account:**
   ```javascript
   db.accounts.findOne({ linkedId: ObjectId("TEACHER_ID") })
   // Kiểm tra: role: "teacher"
   ```

3. **Kiểm tra API `/accounts/me`:**
   ```bash
   GET /api/accounts/me
   Authorization: Bearer <teacher_token>
   ```
   
   Response phải có:
   ```json
   {
     "role": "teacher",
     "teacherFlags": {
       "isLeader": true
     }
   }
   ```

## 🚨 Lưu ý

1. **Teacher phải có Account:** Nếu teacher chưa có account, cần tạo account trước
2. **Cần logout/login lại:** Sau khi set flag, cần logout và login lại để refresh token
3. **Chỉ Admin mới set được:** API `/api/accounts/teacher/:teacherId/flags` chỉ cho phép Admin
4. **Teacher không tự set được:** Teacher không thể tự set quyền của mình

## 🐛 Troubleshooting

### Vấn đề: Login nhưng vẫn không thấy menu BGH

**Giải pháp:**
1. Kiểm tra `isLeader` trong database: `db.teachers.findOne({ _id: ... })`
2. Kiểm tra response của `/api/accounts/me` có `teacherFlags.isLeader: true` không
3. Clear localStorage và login lại
4. Kiểm tra console browser có lỗi không

### Vấn đề: API trả về 403 Forbidden

**Giải pháp:**
1. Đảm bảo đang login với tài khoản Admin
2. Kiểm tra token có hợp lệ không
3. Kiểm tra permission `ROLE_MANAGE` có được gán cho admin không

### Vấn đề: Teacher không có Account

**Giải pháp:**
1. Tạo Account cho teacher qua `/admin/batch` hoặc API
2. Link Account với Teacher: `db.teachers.updateOne({ _id: ... }, { $set: { accountId: ObjectId("ACCOUNT_ID") } })`
3. Hoặc tạo account mới và link trong UI

## 📝 Ví dụ hoàn chỉnh

```bash
# 1. Login với Admin và lấy token
TOKEN="your_admin_token"

# 2. Tìm teacher ID
TEACHER_ID=$(curl -X GET http://localhost:3000/api/teachers \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.name == "Tên Giáo Viên") | ._id')

# 3. Set flag isLeader
curl -X PUT http://localhost:3000/api/accounts/teacher/$TEACHER_ID/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isLeader": true}'

# 4. Kiểm tra
curl -X GET http://localhost:3000/api/teachers/$TEACHER_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.isLeader'
# Kết quả: true
```


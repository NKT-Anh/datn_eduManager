# 🏛️ Phân quyền Ban Giám Hiệu (BGH)

## 📋 Tổng quan

Ban Giám Hiệu (BGH) được xác định bởi flag `isLeader: true` trong `teacherFlags` của teacher. BGH có quyền xem tất cả dữ liệu trong trường nhưng không được tạo/sửa/xóa (chỉ Admin mới có quyền này).

## ✅ Quyền truy cập BGH

### Frontend Routes (được bảo vệ bởi `ProtectedRoute`)

Tất cả routes BGH bắt đầu với prefix `/bgh/` và yêu cầu `isLeader: true`:

- `/bgh/home` - Dashboard BGH
- `/bgh/school-years` - Xem năm học
- `/bgh/students` - Xem danh sách học sinh
- `/bgh/students/:id` - Xem chi tiết học sinh
- `/bgh/teachers` - Xem danh sách giáo viên
- `/bgh/classes` - Xem danh sách lớp
- `/bgh/subjects` - Xem danh sách môn học
- `/bgh/teachingAssignmentPage` - Xem phân công giảng dạy
- `/bgh/schedule` - Xem thời khóa biểu
- `/bgh/grades` - Xem bảng điểm (tất cả lớp/môn)
- `/bgh/conduct` - Xem hạnh kiểm
- `/bgh/exam/exam-list` - Xem danh sách kỳ thi
- `/bgh/exam/:examId` - Xem chi tiết kỳ thi
- `/bgh/exam/exam-dashboard` - Dashboard kỳ thi
- `/bgh/exam/schedule` - Xem lịch thi
- `/bgh/rooms` - Xem danh sách phòng
- `/bgh/incidents` - Xem sự vụ
- `/bgh/notifications` - Xem thông báo
- `/bgh/profile` - Thông tin cá nhân
- `/bgh/settings` - Cài đặt

### Backend Middleware

Sử dụng `checkTeacherFlag({ isLeader: true })` để bảo vệ các routes backend:

```javascript
const checkTeacherFlag = require('../middlewares/checkTeacherFlag');
const authMiddleware = require('../middlewares/authMiddleware');

// Route chỉ cho BGH
router.get('/bgh/students', 
  authMiddleware, 
  checkTeacherFlag({ isLeader: true }), 
  studentController.getAllStudents
);
```

## 🔒 Cơ chế bảo vệ

### Frontend (`ProtectedRoute`)

1. **Kiểm tra authentication**: Nếu chưa đăng nhập → redirect về `/login`
2. **Kiểm tra role**: Phải là `teacher`
3. **Kiểm tra flag**: Phải có `teacherFlags.isLeader === true`
4. **Redirect**: Nếu không có quyền → redirect về trang home phù hợp

### Backend (`checkTeacherFlag`)

1. **Kiểm tra authentication**: Phải có `req.user` (từ `authMiddleware`)
2. **Kiểm tra role**: Phải là `teacher`
3. **Kiểm tra flag**: Phải có `teacher.isLeader === true`
4. **Response**: Nếu không có quyền → trả về `403 Forbidden`

## 📝 Ví dụ sử dụng

### Frontend - Bảo vệ route

```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Trong App.tsx
{ path: "/bgh/students", 
  element: <ProtectedRoute requireFlags={{ isLeader: true }}>
    <BGHStudentsList />
  </ProtectedRoute> 
}
```

### Frontend - Kiểm tra quyền trong component

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { isBGH } from '@/utils/permissions';

const MyComponent = () => {
  const { backendUser } = useAuth();
  
  if (!isBGH(backendUser)) {
    return <div>Bạn không có quyền truy cập</div>;
  }
  
  return <div>Nội dung BGH</div>;
};
```

### Backend - Bảo vệ route

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const checkTeacherFlag = require('../middlewares/checkTeacherFlag');

// Route chỉ cho BGH
router.get('/bgh/students', 
  authMiddleware, 
  checkTeacherFlag({ isLeader: true }), 
  async (req, res) => {
    // req.teacher chứa thông tin teacher
    // req.currentUser chứa thông tin account
    const students = await Student.find({});
    res.json(students);
  }
);
```

## ⚠️ Lưu ý

1. **Ưu tiên flags**: Nếu teacher có nhiều flags (BGH + GVCN), ưu tiên BGH cao nhất
2. **Không có quyền sửa/xóa**: BGH chỉ xem, không được tạo/sửa/xóa dữ liệu
3. **Xem tất cả**: BGH có thể xem tất cả dữ liệu trong trường, không bị giới hạn bởi lớp/môn
4. **Backend validation**: Luôn kiểm tra quyền ở backend, không chỉ dựa vào frontend

## 🔄 So sánh với các roles khác

| Role | Flag | Quyền xem | Quyền sửa |
|------|------|-----------|-----------|
| Admin | - | Tất cả | Tất cả |
| BGH | `isLeader: true` | Tất cả | Không |
| QLBM | `isDepartmentHead: true` | Bộ môn | Bộ môn |
| GVCN | `isHomeroom: true` | Lớp chủ nhiệm | Lớp chủ nhiệm |
| GVBM | - | Lớp đang dạy | Lớp đang dạy |


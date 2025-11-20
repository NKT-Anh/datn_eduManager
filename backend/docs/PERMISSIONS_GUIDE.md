# 📋 Hướng dẫn sử dụng hệ thống phân quyền

## ✅ Các Roles trong hệ thống

- **admin**: Quản trị hệ thống - Có tất cả quyền
- **bgh**: Ban Giám Hiệu - Xem tất cả, không được tạo/sửa/xóa
- **qlbm**: Quản lý bộ môn - Quản lý môn học và giáo viên trong bộ môn
- **gvcn**: Giáo viên chủ nhiệm - Quản lý lớp chủ nhiệm
- **gvbm**: Giáo viên bộ môn - Quản lý lớp đang dạy
- **student**: Học sinh - Chỉ xem thông tin của bản thân

## 🔧 Cách sử dụng

### 1. Import middleware và permissions

```javascript
const checkPermission = require('../middlewares/checkPermission');
const { PERMISSIONS } = require('../config/permissions');
```

### 2. Áp dụng cho routes

```javascript
// ✅ Kiểm tra một permission
router.get('/exams', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_VIEW), 
  examController.getExams
);

// ✅ Kiểm tra nhiều permissions (chỉ cần 1 trong số đó)
router.post('/exams', 
  auth, 
  checkPermission([PERMISSIONS.EXAM_CREATE, PERMISSIONS.EXAM_UPDATE]), 
  examController.createExam
);

// ✅ Kiểm tra tất cả permissions (cần tất cả)
router.delete('/exams/:id', 
  auth, 
  checkPermission([PERMISSIONS.EXAM_DELETE, PERMISSIONS.EXAM_UPDATE], { requireAll: true }), 
  examController.deleteExam
);

// ✅ Tắt kiểm tra context (nếu không cần)
router.get('/exams', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_VIEW, { checkContext: false }), 
  examController.getExams
);
```

### 3. Sử dụng trong controller

```javascript
// ✅ Kiểm tra quyền trong controller
const { hasPermission } = require('../config/permissions');

exports.getExams = async (req, res) => {
  const userRole = req.user.role;
  
  // Kiểm tra quyền
  if (!hasPermission(userRole, PERMISSIONS.EXAM_VIEW)) {
    return res.status(403).json({ error: 'Không có quyền' });
  }
  
  // Lấy context từ middleware (nếu có)
  const context = req.permissionContext;
  
  // Filter dữ liệu theo context
  let filter = {};
  if (context?.homeroomClassIds) {
    // GVCN chỉ xem kỳ thi của lớp chủ nhiệm
    filter.grades = { $in: context.homeroomClassIds };
  }
  
  // ...
};
```

## 📝 Ví dụ áp dụng cho Exam Routes

```javascript
const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const ctrl = require('../../controllers/exam/examController');

// ✅ Tạo kỳ thi - Chỉ Admin
router.post('/', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_CREATE), 
  ctrl.createExam
);

// ✅ Xem danh sách kỳ thi - Tất cả roles có quyền xem
router.get('/', 
  auth, 
  checkPermission([
    PERMISSIONS.EXAM_VIEW,
    PERMISSIONS.EXAM_VIEW_DEPARTMENT,
    PERMISSIONS.EXAM_VIEW_HOMEROOM,
    PERMISSIONS.EXAM_VIEW_TEACHING,
    PERMISSIONS.EXAM_VIEW_SELF
  ]), 
  ctrl.getExams
);

// ✅ Tạo lịch thi tự động - Chỉ Admin
router.post('/schedules/auto-generate', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_SCHEDULE_AUTO), 
  ctrl.autoGenerateSchedules
);

// ✅ Phân phòng thi tự động - Chỉ Admin
router.post('/rooms/auto-assign', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_ROOM_AUTO), 
  ctrl.autoAssignRooms
);

// ✅ Nhập điểm thi - GVBM (môn mình dạy)
router.post('/grades', 
  auth, 
  checkPermission(PERMISSIONS.EXAM_GRADE_ENTER), 
  ctrl.enterExamGrade
);
```

## ⚠️ Lưu ý

1. **Context checking**: Middleware tự động kiểm tra context (lớp chủ nhiệm, môn dạy) dựa trên permission
2. **Role mapping**: 
   - `teacher` role có thể có quyền của `gvcn` hoặc `gvbm` tùy vào `homeroomClassIds`
   - Cần cập nhật logic để tự động map role dựa trên dữ liệu
3. **Performance**: Context checking có thể chậm nếu query nhiều, nên tắt `checkContext` nếu không cần

















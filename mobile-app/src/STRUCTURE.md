# Cấu trúc thư mục Mobile App

## Tổng quan

```
mobile-app/
├── src/
│   ├── context/          # React Context (State Management)
│   ├── features/         # Feature modules (có thể mở rộng)
│   ├── navigation/       # Navigation configuration
│   ├── screens/          # Screen components
│   ├── services/         # API services
│   └── types/            # TypeScript types
├── App.tsx               # Root component
└── index.js              # Entry point
```

## Chi tiết

### `/src/context`
Quản lý state toàn cục của ứng dụng:
- `AuthContext.tsx` - Quản lý authentication state

### `/src/features`
Các feature modules (có thể mở rộng theo feature-based architecture):
- Hiện tại chỉ có file index.ts để export
- Có thể tạo các folder như: `auth`, `student`, `teacher`, etc.

### `/src/navigation`
Cấu hình navigation:
- `AppNavigator.tsx` - Navigator chính
- `AuthNavigator.tsx` - Navigator cho màn hình đăng nhập
- `MainNavigator.tsx` - Navigator cho màn hình chính (sau khi đăng nhập)
- `types.ts` - Type definitions cho navigation

### `/src/screens`
Các màn hình của ứng dụng:
- `auth/` - Màn hình authentication
  - `LoginScreen.tsx`
- `student/` - Màn hình cho học sinh
  - `StudentDashboardScreen.tsx`
  - `StudentScheduleScreen.tsx`
  - `StudentGradesScreen.tsx`
  - `StudentExamsScreen.tsx`
- `teacher/` - Màn hình cho giáo viên
  - `TeacherDashboardScreen.tsx`
  - `TeacherScheduleScreen.tsx`
  - `TeacherExamScheduleScreen.tsx`
  - `TeacherExamRoomsScreen.tsx`
- `HomeScreen.tsx` - Màn hình chủ
- `ProfileScreen.tsx` - Màn hình hồ sơ
- `SettingsScreen.tsx` - Màn hình cài đặt
- `LoadingScreen.tsx` - Màn hình loading

### `/src/services`
API services để giao tiếp với backend:
- `api.ts` - Cấu hình API
- `httpClient.ts` - HTTP client wrapper
- `authService.ts` - Authentication service
- `studentService.ts` - Student-related services
- `teacherService.ts` - Teacher-related services

### `/src/types`
TypeScript type definitions:
- `index.ts` - Common types (User, Student, Teacher, etc.)

## Luồng hoạt động

1. **App.tsx** → Wraps app với `AuthProvider` và `AppNavigator`
2. **AppNavigator** → Kiểm tra authentication state và route đến `AuthNavigator` hoặc `MainNavigator`
3. **AuthNavigator** → Hiển thị màn hình đăng nhập
4. **MainNavigator** → Hiển thị màn hình chính dựa trên role (student/teacher)
5. **Screens** → Sử dụng services để fetch data từ backend

## Cách sử dụng

### Thêm màn hình mới

1. Tạo file trong `/src/screens`
2. Thêm route trong navigation tương ứng
3. Export từ navigation types nếu cần

### Thêm service mới

1. Tạo file trong `/src/services`
2. Sử dụng `httpClient` để gọi API
3. Export từ `services/index.ts`

### Thêm context mới

1. Tạo file trong `/src/context`
2. Wrap component cần dùng với Provider
3. Export từ `context/index.ts`


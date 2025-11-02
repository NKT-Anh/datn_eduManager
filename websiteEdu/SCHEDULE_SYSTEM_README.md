# Hệ thống Tự động Tạo Thời khóa biểu với Kéo thả

## Tổng quan
Hệ thống này cho phép tự động tạo thời khóa biểu dựa trên cấu hình và hỗ trợ kéo thả để điều chỉnh linh hoạt.

## Tính năng chính

### 1. Tự động tạo thời khóa biểu
- Thuật toán thông minh xếp môn học dựa trên:
  - Số tiết/tuần của từng môn
  - Buổi học chính/phụ theo khối
  - Ma trận rảnh của giáo viên (availableMatrix)
  - Quy tắc tiết liên tiếp
- Hỗ trợ 3 khối: 10, 11, 12
- Tự động phân công giáo viên

### 2. Giao diện kéo thả (Drag & Drop)
- Kéo thả môn học giữa các tiết
- Giao diện trực quan với màu sắc phân biệt buổi sáng/chiều
- Chỉnh sửa trực tiếp môn học và giáo viên
- Lưu thay đổi real-time

### 3. Quản lý môn học và hoạt động
- **Môn học**: Thêm môn học mới với cấu hình:
  - Số tiết/tuần
  - Tối đa tiết/ngày
  - Cho phép tiết liên tiếp
  - Buổi học (chính/phụ)
- **Hoạt động**: Quản lý hoạt động đặc biệt:
  - **Hoạt động cố định**: Chào cờ (Thứ 2, Tiết 1), Sinh hoạt chủ nhiệm (Thứ 7, Tiết 1)
    - Tự động gắn vào vị trí cố định, không bị thuật toán xếp lịch động
    - Hiển thị màu cam và nhãn "(Cố định)" trong giao diện
    - Không thể kéo thả hoặc chỉnh sửa
  - **Hoạt động linh hoạt**: Thể dục, Ngoại khóa, ...
    - Được thuật toán xếp lịch tự động
    - Có thể kéo thả và chỉnh sửa
  - Áp dụng cho các khối cụ thể

### 4. Tạo lớp tự động
- Tạo hàng loạt lớp cho các khối
- Cấu hình sĩ số tối đa
- Đặt tên lớp theo chuẩn (10A1, 10A2, ...)

## Cách sử dụng

### Bước 1: Cấu hình thời khóa biểu
1. Vào tab "Cấu hình" trong trang Quản lý Thời khóa biểu
2. Thiết lập:
   - Giờ bắt đầu buổi sáng/chiều
   - Số tiết mỗi ngày
   - Thời gian nghỉ đặc biệt
   - Quy tắc buổi học cho từng khối

### Bước 2: Tạo lớp
1. Nhấn nút "Tạo lớp tự động"
2. Chọn khối (10, 11, 12)
3. Đặt số lớp mỗi khối và sĩ số
4. Nhấn "Tạo lớp"

### Bước 3: Quản lý hoạt động
1. Vào trang Quản lý Hoạt động
2. Tạo các hoạt động cần thiết:
   - **Hoạt động cố định**:
     - Chào cờ (Thứ 2, Tiết 1) - sẽ tự động gắn cố định
     - Sinh hoạt chủ nhiệm (Thứ 7, Tiết 1) - sẽ tự động gắn cố định
   - **Hoạt động linh hoạt**:
     - Thể dục (có thể xếp linh hoạt)
     - Ngoại khóa (có thể xếp linh hoạt)
3. Thiết lập khối áp dụng và thời gian

### Bước 4: Phân công giáo viên
1. Vào trang Quản lý Phân công giảng dạy
2. Gán giáo viên cho từng môn học của lớp
3. Thiết lập ma trận rảnh (availableMatrix) cho giáo viên

### Bước 5: Tạo thời khóa biểu tự động
1. Chọn năm học và học kỳ
2. Chọn khối cần tạo lịch
3. Nhấn "Tạo thời khóa biểu tự động"
4. Hệ thống sẽ tự động xếp lịch dựa trên cấu hình

### Bước 6: Điều chỉnh bằng kéo thả
1. Chọn lớp để xem thời khóa biểu
2. Kéo thả môn học giữa các tiết
3. Nhấn "Lưu" để lưu thay đổi

## Cấu trúc dữ liệu

### ScheduleConfig
```json
{
  "defaultStartTimeMorning": "07:00",
  "defaultStartTimeAfternoon": "12:30",
  "minutesPerPeriod": 45,
  "defaultBreakMinutes": 5,
  "specialBreaks": [
    {
      "period": 2,
      "session": "morning",
      "minutes": 25
    }
  ],
  "days": {
    "mon": {
      "totalPeriods": 10,
      "morningPeriods": 5,
      "afternoonPeriods": 5
    }
  },
  "subjectHours": {
    "Toán": {
      "periodsPerWeek": 6,
      "maxPeriodsPerDay": 2,
      "allowConsecutive": true,
      "session": "main"
    }
  },
  "gradeSessionRules": [
    {
      "grade": "10",
      "session": "morning"
    },
    {
      "grade": "11", 
      "session": "afternoon"
    },
    {
      "grade": "12",
      "session": "morning"
    }
  ]
}
```

### TeachingAssignment với availableMatrix
```json
{
  "teacherId": {
    "availableMatrix": [
      [true, true, true, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true, true, true],
      [false, false, false, false, false, false, false, false, false, false],
      [true, true, true, true, true, true, true, true, true, true],
      [true, true, true, true, true, true, true, true, true, true]
    ]
  },
  "subjectId": {
    "name": "Toán"
  },
  "classId": {
    "classCode": "2025-2026-10a2"
  }
}
```

## API Endpoints

### Backend
- `POST /api/auto-schedule/generate` - Tạo thời khóa biểu tự động
- `PUT /api/auto-schedule/drag-drop` - Cập nhật bằng kéo thả
- `POST /api/auto-schedule/create-classes` - Tạo lớp tự động

### Frontend Services
- `autoScheduleApi.generateSchedule()` - Tạo thời khóa biểu
- `autoScheduleApi.updateByDragDrop()` - Cập nhật kéo thả
- `autoScheduleApi.createClasses()` - Tạo lớp

## Lưu ý quan trọng

1. **Ma trận rảnh giáo viên**: Cần thiết lập đúng để hệ thống xếp lịch chính xác
2. **Cấu hình môn học**: Đảm bảo số tiết/tuần phù hợp với chương trình
3. **Quy tắc buổi học**: Khối 10, 12 học sáng, khối 11 học chiều
4. **Lưu thay đổi**: Luôn nhấn "Lưu" sau khi điều chỉnh

## Troubleshooting

### Lỗi thường gặp
1. **Không tạo được lịch**: Kiểm tra cấu hình và phân công giáo viên
2. **Kéo thả không hoạt động**: Cài đặt react-beautiful-dnd
3. **Lưu thất bại**: Kiểm tra kết nối API và dữ liệu

### Debug
- Mở Developer Tools để xem console logs
- Kiểm tra Network tab để debug API calls
- Xem dữ liệu trong Database để verify

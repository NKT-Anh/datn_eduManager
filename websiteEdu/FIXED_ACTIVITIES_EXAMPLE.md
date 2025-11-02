# Ví dụ về Hoạt động Cố định trong Thời khóa biểu

## Tổng quan
Hệ thống hỗ trợ 2 loại hoạt động:
- **Hoạt động cố định**: Có ngày và tiết học cố định, không bị thuật toán xếp lịch động
- **Hoạt động linh hoạt**: Được thuật toán xếp lịch tự động, có thể kéo thả

## Cách tạo Hoạt động Cố định

### 1. Tạo hoạt động Chào cờ
```json
{
  "name": "Chào cờ",
  "type": "weekly",
  "grades": ["10", "11", "12"],
  "dayOfWeek": "Monday",
  "timeSlot": "Tiết 1",
  "startDate": "2025-09-01",
  "endDate": "2026-05-31",
  "isActive": true
}
```

### 2. Tạo hoạt động Sinh hoạt chủ nhiệm
```json
{
  "name": "Sinh hoạt chủ nhiệm",
  "type": "weekly", 
  "grades": ["10", "11", "12"],
  "dayOfWeek": "Saturday",
  "timeSlot": "Tiết 1",
  "startDate": "2025-09-01",
  "endDate": "2026-05-31",
  "isActive": true
}
```

## Cách hoạt động

### Thuật toán xếp lịch
1. **Bước 1**: Xếp các hoạt động cố định trước
   - Chào cờ → Thứ 2, Tiết 1
   - Sinh hoạt chủ nhiệm → Thứ 7, Tiết 1
   - Đánh dấu các tiết này đã được cố định

2. **Bước 2**: Xếp môn học và hoạt động linh hoạt
   - Bỏ qua các tiết đã được cố định
   - Chỉ xếp vào các tiết trống

### Giao diện hiển thị
- **Hoạt động cố định**:
  - Màu nền: Cam nhạt (`bg-orange-100`)
  - Viền: Cam (`border-orange-300`)
  - Badge: Đỏ (`variant="destructive"`)
  - Nhãn: "(Cố định)"
  - Cursor: `cursor-default` (không thể kéo)
  - Không có nút chỉnh sửa

- **Môn học/Hoạt động linh hoạt**:
  - Màu nền: Trắng (`bg-white`)
  - Viền: Xám (`border-gray-200`)
  - Badge: Xám (`variant="secondary"`)
  - Cursor: `cursor-move` (có thể kéo)
  - Có nút chỉnh sửa

## Ví dụ Thời khóa biểu

### Trước khi xếp lịch
```
Thứ 2: [Trống] [Trống] [Trống] [Trống] [Trống]
Thứ 7: [Trống] [Trống] [Trống] [Trống] [Trống]
```

### Sau khi xếp hoạt động cố định
```
Thứ 2: [Chào cờ (Cố định)] [Trống] [Trống] [Trống] [Trống]
Thứ 7: [Sinh hoạt chủ nhiệm (Cố định)] [Trống] [Trống] [Trống] [Trống]
```

### Sau khi xếp môn học
```
Thứ 2: [Chào cờ (Cố định)] [Toán] [Văn] [Anh] [Lý]
Thứ 7: [Sinh hoạt chủ nhiệm (Cố định)] [Hóa] [Sinh] [Sử] [Địa]
```

## Lợi ích

1. **Đảm bảo hoạt động quan trọng**: Chào cờ và sinh hoạt chủ nhiệm luôn ở vị trí cố định
2. **Tránh xung đột**: Thuật toán không thể ghi đè lên hoạt động cố định
3. **Giao diện rõ ràng**: Dễ phân biệt hoạt động cố định và linh hoạt
4. **Linh hoạt**: Vẫn có thể tạo hoạt động linh hoạt cho các môn như Thể dục

## Lưu ý

- Hoạt động cố định không thể kéo thả hoặc chỉnh sửa qua giao diện
- Nếu muốn thay đổi, phải sửa trong trang Quản lý Hoạt động
- Hoạt động cố định sẽ ưu tiên tiết được chỉ định trong `timeSlot`
- Nếu tiết đã có môn học, sẽ tìm tiết trống gần nhất

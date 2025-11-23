# Logic Tự Động Gán Phòng

## 📋 Tổng quan
Chức năng tự động gán phòng cho các lớp học dựa trên quy tắc:
- Tìm phòng có `roomCode` trùng với `className` của lớp
- Kiểm tra các quy tắc gán phòng để tránh xung đột

## 🔄 Quy trình xử lý

### 1. Lấy danh sách lớp cần gán phòng
```javascript
// Lấy tất cả lớp chưa có phòng (roomId = null)
// Có thể lọc theo năm học (year) nếu cần
const classesWithoutRoom = await Class.find({ roomId: null, year: year });
```

### 2. Duyệt từng lớp và thực hiện gán phòng

#### Bước 1: Tìm phòng trùng tên
```javascript
// Tìm phòng có roomCode trùng với className
const matchingRoom = await Room.findOne({ roomCode: cls.className });
// VD: Lớp "10A1" → Tìm phòng có code "10A1"
```

**Nếu không tìm thấy:**
- Bỏ qua lớp này (skipped)
- Ghi log: "Không tìm thấy phòng có code trùng với tên lớp"

#### Bước 2: Kiểm tra quy tắc cùng khối
```javascript
// Kiểm tra xem trong cùng khối và cùng năm học, 
// đã có lớp nào dùng phòng này chưa
const otherClassSameGrade = await Class.findOne({
  roomId: matchingRoom._id,
  year: cls.year,
  grade: cls.grade,  // Cùng khối
  _id: { $ne: cls._id },
});
```

**Nếu có lớp khác trong cùng khối đã dùng phòng:**
- Bỏ qua lớp này (skipped)
- Ghi log: "Phòng X đã được sử dụng bởi lớp Y trong cùng khối Z"

#### Bước 3: Kiểm tra quy tắc khác khối (nếu có lớp khác khối đã dùng phòng)
```javascript
// Tìm các lớp khác khối đã dùng phòng này
const otherClassesDifferentGrade = await Class.find({
  roomId: matchingRoom._id,
  year: cls.year,
  grade: { $ne: cls.grade },  // Khác khối
});
```

**Nếu có lớp khác khối đã dùng phòng:**
- Lấy schedule của lớp hiện tại và các lớp khác
- Kiểm tra xem có trùng buổi học không

**Logic kiểm tra trùng buổi:**
```javascript
// 1. Lấy schedule config để biết số tiết buổi sáng
const scheduleConfig = await ScheduleConfig.findOne();
const morningPeriods = dayConfig?.morningPeriods || 5; // Mặc định 5 tiết sáng

// 2. Xác định buổi học dựa vào số tiết
// - Tiết <= morningPeriods → buổi sáng (morning)
// - Tiết > morningPeriods → buổi chiều (afternoon)
const session = periodNumber <= morningPeriods ? 'morning' : 'afternoon';

// 3. Tạo key để so sánh: "day-periodNumber-session"
// VD: "mon-1-morning", "tue-6-afternoon"
const periodKey = `${dayEntry.day}-${periodNumber}-${session}`;

// 4. So sánh với schedule của các lớp khác
// Nếu có trùng key → trùng buổi → không cho phép gán
```

**Nếu trùng buổi:**
- Bỏ qua lớp này (skipped)
- Ghi log: "Phòng X đã được sử dụng bởi lớp Y (khối Z) trong cùng buổi"

**Nếu không trùng buổi:**
- Cho phép gán phòng

#### Bước 4: Gán phòng
```javascript
// Nếu tất cả kiểm tra đều pass → gán phòng
cls.roomId = matchingRoom._id;
await cls.save();
assigned++; // Tăng số lớp đã gán thành công
```

## 📊 Kết quả trả về

```javascript
{
  message: "Đã tự động gán phòng: X lớp thành công, Y lớp bỏ qua, Z lớp lỗi",
  assigned: 10,    // Số lớp đã gán thành công
  skipped: 5,      // Số lớp bỏ qua (không tìm thấy phòng hoặc vi phạm quy tắc)
  failed: 0,       // Số lớp lỗi (exception)
  details: [       // Chi tiết từng lớp
    {
      className: "10A1",
      status: "assigned",  // hoặc "skipped" hoặc "failed"
      roomCode: "10A1",    // Nếu assigned
      reason: "..."       // Nếu skipped hoặc failed
    },
    // ...
  ]
}
```

## 🎯 Quy tắc gán phòng

### Quy tắc 1: Cùng khối
- **Không cho phép**: Trong cùng khối và cùng năm học, mỗi phòng chỉ được gán cho 1 lớp
- **Ví dụ**: Khối 10, lớp 10A2 đã gán phòng 10A2 → Lớp 10A1 không được gán phòng 10A2

### Quy tắc 2: Khác khối
- **Cho phép nếu**: Khác buổi học (sáng/chiều)
- **Không cho phép nếu**: Cùng buổi học (có tiết trùng)
- **Ví dụ**: 
  - Khối 10 học buổi sáng, Khối 11 học buổi chiều → Có thể dùng chung phòng ✅
  - Khối 10 học buổi sáng, Khối 11 cũng học buổi sáng → Không thể dùng chung phòng ❌

## 🔧 API Endpoint

### Backend
```
POST /api/class/auto-assign-rooms
Query params: year (optional)
Response: {
  message: string,
  assigned: number,
  skipped: number,
  failed: number,
  details: Array<{...}>
}
```

### Frontend
```typescript
// websiteEdu/src/services/classApi.ts
classApi.autoAssignRooms(year?: string)

// websiteEdu/src/pages/admin/ClassesPage.tsx
<Button onClick={handleAutoAssignRooms}>
  <Building2 /> Tự động gán phòng
</Button>
```

## 📝 Lưu ý

1. **Schedule Config**: Cần có cấu hình thời khóa biểu trước khi tự động gán phòng
2. **Schedule của lớp**: Nếu lớp chưa có schedule, vẫn cho phép gán (sẽ kiểm tra lại sau khi có schedule)
3. **Năm học**: Có thể lọc theo năm học, nếu không chỉ định thì xử lý tất cả các năm học
4. **Xử lý lỗi**: Mỗi lớp được xử lý độc lập, lỗi ở một lớp không ảnh hưởng đến các lớp khác

## 🎨 UI/UX

- Nút "Tự động gán phòng" nằm ở header của trang quản lý lớp
- Hiển thị toast notification với kết quả:
  - Số lớp đã gán thành công
  - Số lớp bỏ qua
  - Số lớp lỗi
- Chi tiết được log vào console để admin có thể xem






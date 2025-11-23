# 📚 LOGIC HỆ THỐNG KỲ THI

## 🎯 Tổng quan

Hệ thống quản lý kỳ thi với cấu trúc:
- **Kỳ thi (Exam)**: Chứa thông tin tổng quan (năm học, học kỳ, khối tham gia)
- **Lịch thi (ExamSchedule)**: Mỗi môn thi có lịch riêng (ngày, giờ, ca)
- **Học sinh dự thi (ExamStudent)**: Danh sách học sinh tham gia kỳ thi
- **Phòng thi (ExamRoom)**: Có 2 loại:
  - **Phòng thi cố định (baseRoom)**: `schedule = null`, ổn định suốt kỳ thi
  - **Phòng thi riêng từng môn (scheduleRoom)**: `schedule != null`, gắn với lịch thi cụ thể
- **Phân phòng (RoomAssignment)**: Học sinh được gán vào phòng thi cho từng môn

## 📋 QUY TRÌNH TẠO KỲ THI

### 1️⃣ Tạo Kỳ Thi (Exam)
```
Thông tin cần có:
- name: Tên kỳ thi
- year: Năm học (VD: "2025-2026")
- semester: Học kỳ ("1" hoặc "2")
- grades: Danh sách khối tham gia (["10", "11", "12"])
- startDate, endDate: Thời gian kỳ thi
- type: Loại kỳ thi (regular, mock, graduation)
```

**Tự động:**
- ✅ Tự động thêm học sinh vào kỳ thi:
  - Lọc học sinh: `currentYear = exam.year` và `grade IN exam.grades`
  - Chỉ lấy học sinh có `classId` (đã được gán vào lớp)
  - Tạo `ExamStudent` với `sbd` tự động

### 2️⃣ Tạo Lịch Thi (ExamSchedule)
```
Thông tin cần có:
- exam: ID kỳ thi
- grade: Khối thi (VD: "10")
- subject: Môn thi
- date: Ngày thi
- startTime: Giờ bắt đầu (VD: "07:00")
- duration: Thời gian thi (phút)
```

**Tự động:**
- ✅ Tự động tạo phòng thi cho lịch thi:
  - Đếm số học sinh: `ExamStudent` với `exam` và `grade`
  - Tính số phòng: `Math.ceil(số học sinh / 20)`
  - **Lịch thi đầu tiên (chưa có phòng thi cố định cho khối này):**
    - Tạo **phòng thi cố định (baseRoom)** với `schedule = null` từ `Room` (status: "available", type: "normal")
    - Phân bổ học sinh đều vào các phòng (A-Z theo tên)
    - Gán `ExamStudent.room` = phòng thi cố định (dùng cho các lịch thi sau)
    - Tạo **phòng thi riêng từng môn (scheduleRoom)** với `schedule = scheduleId` (sao chép từ baseRoom)
    - Tạo `RoomAssignment` cho lịch thi này
  - **Lịch thi tiếp theo (đã có phòng thi cố định cho khối này):**
    - Tạo **phòng thi riêng từng môn (scheduleRoom)** với `schedule = scheduleId`
    - Sao chép từ phòng thi cố định (roomCode, capacity, type, grade, note)
    - KHÔNG sao chép invigilators (mỗi lịch thi có giám thị riêng)
    - Dựa trên `ExamStudent.room` (phòng thi cố định) để gán học sinh
    - Tạo `RoomAssignment` cho lịch thi mới với phòng thi tương ứng
    - Giữ nguyên thứ tự học sinh (A-Z)

### 3️⃣ Phân Phòng Cho Học Sinh

**Logic phân phòng:**
- Học sinh được phân vào `FixedExamRoom` (phòng lý thuyết):
  - `ExamStudent.room`: Reference đến `FixedExamRoom` - ổn định suốt kỳ thi
  - `FixedExamRoom.students`: Danh sách `ExamStudent` IDs
  - `FixedExamRoom.code`: Mã phòng lý thuyết (VD: "10-1", "10-2")
- Khi tạo lịch thi mới:
  - Tạo `ExamRoom` liên kết `FixedExamRoom` (lý thuyết) với `Room` (vật lý) cho schedule đó
  - CÙNG 1 `FixedExamRoom` có thể thi ở PHÒNG VẬT LÝ KHÁC NHAU cho mỗi schedule
  - Tự động tạo `RoomAssignment` cho tất cả học sinh trong `FixedExamRoom`

**RoomAssignment:**
- Lưu mối quan hệ: `schedule` + `examRoom` + `examStudent`
- Mỗi lịch thi có danh sách học sinh riêng
- Đảm bảo: Các học sinh trong cùng `FixedExamRoom` sẽ thi các môn khác mà không mất hay thêm ai

## 🔄 QUAN HỆ GIỮA CÁC ENTITY

```
Exam (Kỳ thi)
├── ExamStudent (Học sinh dự thi)
│   ├── room: FixedExamRoom (phòng thi cố định "lý thuyết")
│   │   - Ổn định suốt kỳ thi
│   │   - Chứa danh sách học sinh (nhóm học sinh)
│   └── grade: Khối học
│
├── FixedExamRoom (Phòng thi cố định "lý thuyết")
│   ├── exam: Exam
│   ├── grade: Khối học
│   ├── code: Mã phòng lý thuyết (VD: "10-1", "10-2")
│   ├── students: [ExamStudent IDs] (danh sách học sinh)
│   └── capacity: Số học sinh
│   ⚠️ QUAN TRỌNG: FixedExamRoom là phòng "lý thuyết", KHÔNG có roomCode vật lý
│
├── ExamSchedule (Lịch thi)
│   ├── exam: Exam
│   ├── grade: Khối thi
│   ├── subject: Môn thi
│   └── date, startTime, duration
│
├── Room (Phòng vật lý thật)
│   ├── roomCode: Mã phòng vật lý (VD: "A101", "A102", "Lab1")
│   ├── type: Loại phòng ("normal", "lab", "computer")
│   └── status: Trạng thái ("available", "maintenance", "inactive")
│
├── ExamRoom (Cầu nối giữa FixedExamRoom và Room)
│   ├── exam: Exam
│   ├── schedule: ExamSchedule (BẮT BUỘC - phòng thi riêng từng môn)
│   ├── fixedExamRoom: FixedExamRoom (phòng lý thuyết - lấy danh sách học sinh)
│   ├── room: Room (phòng vật lý thật - A101, A102, Lab1...)
│   ├── roomCode: Mã phòng vật lý (từ Room.roomCode)
│   ├── type: Loại phòng vật lý (từ Room.type)
│   ├── capacity: Sức chứa
│   └── invigilators: Giám thị (riêng cho từng lịch thi)
│
│   ⚠️ QUAN TRỌNG: 
│   - CÙNG 1 FixedExamRoom có thể thi ở PHÒNG VẬT LÝ KHÁC NHAU cho mỗi môn/ngày
│   - Ví dụ: FixedExamRoom "10-1" (20 học sinh)
│     + Schedule Toán: ExamRoom { fixedExamRoom: "10-1", room: A101 }
│     + Schedule Văn: ExamRoom { fixedExamRoom: "10-1", room: A102 }
│     + Schedule Anh: ExamRoom { fixedExamRoom: "10-1", room: Lab1 }
│
└── RoomAssignment (Phân phòng)
    ├── exam: Exam
    ├── schedule: ExamSchedule (lịch thi cụ thể)
    ├── examRoom: ExamRoom (phòng thi trong lịch thi này)
    ├── examStudent: ExamStudent
    ├── seatNumber: Số thứ tự trong phòng
    └── sbd: Số báo danh
```

## 🎯 LOGIC PHÂN PHÒNG

### Khi tạo lịch thi đầu tiên (VD: Toán - Khối 10):
1. **Tạo FixedExamRoom (phòng lý thuyết):**
   - Tạo `FixedExamRoom` với `code = "10-1", "10-2", ...` (tự động)
   - Đây là phòng thi "lý thuyết", chỉ chứa danh sách học sinh
2. **Tự động phân phòng học sinh:**
   - Lấy học sinh: `ExamStudent` với `exam`, `grade`, `room = null`, `status = "active"`
   - Sắp xếp A-Z theo tên
   - Phân bổ đều vào các `FixedExamRoom` (chênh lệch tối đa 1)
   - Gán `ExamStudent.room` = `FixedExamRoom._id`
3. **Tạo ExamRoom (liên kết FixedExamRoom với Room vật lý):**
   - Tạo `ExamRoom` với `schedule = scheduleId`, `fixedExamRoom = FixedExamRoom._id`, `room = Room._id`
   - Mỗi `FixedExamRoom` được liên kết với 1 `Room` vật lý cho schedule này
   - Tạo `RoomAssignment` cho tất cả học sinh trong `FixedExamRoom`

### Khi tạo lịch thi tiếp theo (VD: Lý - Khối 10):
1. **Tạo ExamRoom mới (có thể dùng phòng vật lý khác):**
   - Tạo `ExamRoom` với `schedule = scheduleId` (lịch thi Lý)
   - Liên kết `fixedExamRoom` (cùng nhóm học sinh) với `Room` vật lý (có thể khác phòng Toán)
   - Ví dụ: FixedExamRoom "10-1" thi Toán ở A101, thi Lý ở A102
2. **Tự động gán học sinh vào phòng thi tương ứng:**
   - Lấy học sinh từ `FixedExamRoom.students`
   - Tạo `RoomAssignment` với `examRoom` = ExamRoom mới (cho schedule Lý)
   - Giữ nguyên thứ tự học sinh (A-Z)
3. **Đảm bảo:** Học sinh trong cùng `FixedExamRoom` sẽ thi các môn khác mà không mất hay thêm ai

## 📊 VÍ DỤ CỤ THỂ

### Kỳ thi: HK1 2025-2026, Khối 10, 11, 12

**Bước 1: Tạo kỳ thi**
- Tự động thêm 150 học sinh khối 10 vào `ExamStudent`

**Bước 2: Tạo lịch thi Toán - Khối 10**
- Đếm: 150 học sinh → Cần 8 FixedExamRoom (150/20 = 7.5 → 8)
- **Tạo 8 FixedExamRoom (phòng lý thuyết):** "10-1", "10-2", ..., "10-8"
- Phân bổ học sinh (A-Z, phân bổ đều):
  - FixedExamRoom "10-1": 19 học sinh (An, Bình, Cường, ...)
  - FixedExamRoom "10-2": 19 học sinh
  - ...
  - FixedExamRoom "10-8": 16 học sinh
- Gán `ExamStudent.room` = `FixedExamRoom._id`
- **Tạo 8 ExamRoom (liên kết FixedExamRoom với Room vật lý):**
  - ExamRoom { fixedExamRoom: "10-1", room: A101, schedule: Toán }
  - ExamRoom { fixedExamRoom: "10-2", room: A102, schedule: Toán }
  - ...
- Tạo `RoomAssignment` cho lịch thi Toán

**Bước 3: Tạo lịch thi Lý - Khối 10**
- **Tạo 8 ExamRoom mới (có thể dùng phòng vật lý khác):**
  - ExamRoom { fixedExamRoom: "10-1", room: A102, schedule: Lý } ← Khác phòng Toán!
  - ExamRoom { fixedExamRoom: "10-2", room: A103, schedule: Lý }
  - ...
- Tự động gán học sinh:
  - Lấy học sinh từ `FixedExamRoom.students`
  - Tạo `RoomAssignment` với `examRoom` = ExamRoom mới (cho schedule Lý)
  - Giữ nguyên thứ tự học sinh (A-Z)
- Kết quả: Học sinh trong cùng FixedExamRoom sẽ thi các môn khác (có thể ở phòng vật lý khác nhau)

## ✅ ĐẢM BẢO

1. **Cùng phòng, cùng khối**: Học sinh thi chung phòng với nhau sẽ thi các môn khác mà không mất hay thêm ai
2. **Phân bổ đều**: Số học sinh mỗi phòng chênh lệch tối đa 1
3. **Sắp xếp A-Z**: Học sinh được sắp xếp theo tên (A-Z) trong mỗi phòng
4. **Giám thị riêng**: Mỗi lịch thi có giám thị riêng (không sao chép invigilators)


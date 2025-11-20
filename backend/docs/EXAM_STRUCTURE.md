# 📋 Cấu trúc Kỳ Thi và Mối Quan Hệ

## 🏗️ Tổng quan

Hệ thống quản lý kỳ thi được xây dựng với các entity chính:

```
Exam (Kỳ thi)
  ├── ExamSchedule (Lịch thi cho từng môn)
  │     └── ExamRoom (Phòng thi)
  │           └── RoomAssignment (Học sinh - Môn - Phòng - Ca thi)
  ├── ExamStudent (Học sinh dự thi)
  │     └── ExamGrade (Học sinh - Môn - Điểm)
```

## 📊 Chi tiết các Entity

### 1. **Exam** - Kỳ thi
- **Mục đích**: Quản lý thông tin kỳ thi (tên, năm học, học kỳ, khối tham gia)
- **Trường chính**:
  - `year`: Năm học (VD: "2025-2026")
  - `semester`: Học kỳ ("1" hoặc "2")
  - `grades`: Danh sách khối tham gia (["10", "11", "12"])
  - `startDate`, `endDate`: Thời gian kỳ thi
  - `status`: Trạng thái (draft, published, locked, archived)

### 2. **ExamSchedule** - Lịch thi cho từng môn
- **Mục đích**: Quản lý lịch thi cụ thể cho từng môn học
- **Trường chính**:
  - `exam`: Liên kết với Exam
  - `subject`: Môn thi (Toán, Văn, Anh, ...)
  - `grade`: Khối thi (10, 11, 12)
  - `date`: Ngày thi
  - `startTime`, `endTime`: Giờ thi (VD: "07:00", "09:00")
  - `duration`: Thời lượng (phút)
  - `status`: Trạng thái (draft, confirmed, completed)

### 3. **ExamRoom** - Phòng thi
- **Mục đích**: Quản lý phòng thi cho từng lịch thi
- **Trường chính**:
  - `exam`: Liên kết với Exam
  - `schedule`: Liên kết với ExamSchedule (có thể null khi tạo kỳ thi)
  - `room`: Liên kết với Room (phòng học gốc)
  - `roomCode`: Mã phòng (VD: "A101")
  - `type`: Loại phòng (normal, lab, computer)
  - `students`: Array Student IDs (danh sách học sinh trong phòng)
  - `capacity`: Sức chứa (mặc định 24)
  - `invigilators`: Danh sách giám thị

### 4. **ExamStudent** - Học sinh dự thi
- **Mục đích**: Quản lý học sinh tham gia kỳ thi
- **Trường chính**:
  - `exam`: Liên kết với Exam
  - `student`: Liên kết với Student
  - `class`: Liên kết với Class
  - `grade`: Khối (String: "10", "11", "12")
  - `room`: Liên kết với ExamRoom (phòng thi được gán)
  - `sbd`: Số báo danh
  - `subjects`: Array các môn đăng ký
    - `subject`: Môn thi
    - `examSchedule`: Lịch thi cụ thể
    - `status`: Trạng thái (registered, completed, absent)
    - `score`: Điểm (nếu có)
  - `status`: Trạng thái tổng (active, absent, excluded)

### 5. **RoomAssignment** - Phân phòng thi
- **Mục đích**: Bảng trung gian liên kết Học sinh - Môn - Phòng - Ca thi
- **Trường chính**:
  - `exam`: Liên kết với Exam
  - `schedule`: Liên kết với ExamSchedule (ca thi)
  - `subject`: Môn thi
  - `examRoom`: Liên kết với ExamRoom (phòng thi)
  - `examStudent`: Liên kết với ExamStudent (học sinh)
  - `sbd`: Số báo danh
  - `seatNumber`: Số ghế trong phòng

### 6. **ExamGrade** - Điểm thi
- **Mục đích**: Quản lý điểm thi của học sinh theo từng môn
- **Trường chính**:
  - `exam`: Liên kết với Exam
  - `examSchedule`: Liên kết với ExamSchedule (ca thi)
  - `student`: Liên kết với ExamStudent
  - `subject`: Môn thi
  - `room`: Liên kết với ExamRoom (phòng thi)
  - `gradeValue`: Điểm (0-10)
  - `teacher`: Giáo viên chấm thi
  - `isLocked`: Trạng thái khóa điểm

## 🔗 Mối Quan Hệ

### Học sinh - Môn - Phòng - Ca thi
```
ExamStudent (Học sinh)
  └── RoomAssignment
        ├── ExamSchedule (Ca thi - Môn)
        └── ExamRoom (Phòng thi)
```

**Ví dụ**:
- Học sinh: Nguyễn Văn A
- Môn: Toán
- Phòng: A101
- Ca thi: 11/11/2025, 07:00-09:00

### Học sinh - Môn - Điểm
```
ExamStudent (Học sinh)
  └── ExamGrade
        ├── Subject (Môn)
        ├── ExamSchedule (Ca thi)
        └── gradeValue (Điểm)
```

**Ví dụ**:
- Học sinh: Nguyễn Văn A
- Môn: Toán
- Điểm: 8.5
- Ca thi: 11/11/2025, 07:00-09:00

## 🔄 Quy trình Tạo Kỳ Thi

1. **Tạo Exam** (Kỳ thi)
   - Tự động thêm học sinh từ Student model (theo `currentYear` và `grade`)
   - Tự động tạo phòng thi từ Room model (chỉ phòng thường `type: "normal"`)

2. **Tạo ExamSchedule** (Lịch thi)
   - Tự động tạo phòng thi cho lịch thi đó (nếu chưa có)

3. **Phân phòng thi** (RoomAssignment)
   - Tự động hoặc thủ công gán học sinh vào phòng thi
   - Cập nhật `ExamRoom.students` và `ExamStudent.room`

4. **Nhập điểm** (ExamGrade)
   - Tạo bản ghi điểm cho từng học sinh - môn - ca thi

## 📝 Lưu ý

1. **ExamRoom.students**: Array Student IDs, được cập nhật khi gán học sinh vào phòng
2. **ExamStudent.room**: Liên kết với ExamRoom, được cập nhật khi phân phòng
3. **RoomAssignment**: Bảng trung gian để quản lý chi tiết phân phòng (số ghế, SBD)
4. **ExamGrade**: Mỗi học sinh có thể có nhiều điểm (mỗi môn một điểm)
5. **ExamStudent.subjects**: Array các môn đăng ký, có thể liên kết với ExamSchedule



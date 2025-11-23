# 📋 Flow Các Bước Hành Động Trước Khi Tự Động Tạo Thời Khóa Biểu

## 🎯 Mục đích
Tài liệu này mô tả các bước cần thực hiện trước khi tự động tạo thời khóa biểu cho toàn trường.

## 🔄 Flow Tổng Quan

```
1. Cấu hình thời khóa biểu (ScheduleConfig)
   ↓
2. Tạo lớp học (Classes)
   ↓
3. Tạo và kích hoạt môn học (Subjects)
   ↓
4. Tạo và kích hoạt hoạt động (Activities) - Tùy chọn
   ↓
5. Phân công giảng dạy (TeachingAssignment)
   ↓
6. Cấu hình ma trận rảnh cho giáo viên (Teacher.availableMatrix)
   ↓
7. Kiểm tra ràng buộc (maxClassPerGrade, weeklyLessons)
   ↓
8. Kiểm tra tổng số tiết
   ↓
9. ✅ Sẵn sàng tạo lịch
```

---

## 📝 Chi Tiết Từng Bước

### **Bước 1: Cấu hình thời khóa biểu (ScheduleConfig)** ✅ BẮT BUỘC

**Mục đích:** Thiết lập cấu hình cơ bản cho thời khóa biểu

**Các thao tác:**
1. Vào **"Cấu hình thời khóa biểu"**
2. Cấu hình **"Số tiết / Ngày"**:
   - Thiết lập số tiết cho từng ngày trong tuần (Monday - Saturday)
   - Thiết lập số tiết buổi sáng (morningPeriods) và buổi chiều (afternoonPeriods)
3. Cấu hình **"Số tiết / Môn & Hoạt động"**:
   - Thiết lập số tiết/tuần cho từng môn học theo khối (10, 11, 12)
   - Thiết lập số tiết/tuần cho từng hoạt động theo khối
   - Cấu hình các thông số: `maxPeriodsPerDay`, `allowConsecutive`, `session`
4. Cấu hình **"Buổi học theo khối"**:
   - Thiết lập buổi học chính cho từng khối (morning/afternoon/both)
5. Lưu cấu hình

**Kiểm tra:**
- ✅ Có cấu hình `days` (ít nhất 1 ngày)
- ✅ Có cấu hình `subjectHours` (khuyến nghị)

**API:** `POST /api/schedule-config` hoặc `PUT /api/schedule-config/:id`

---

### **Bước 2: Tạo lớp học (Classes)** ✅ BẮT BUỘC

**Mục đích:** Tạo các lớp học cho các khối cần tạo lịch

**Các thao tác:**
1. Vào **"Quản lý lớp học"**
2. Tạo lớp học cho từng khối (10, 11, 12):
   - Nhập tên lớp (ví dụ: "10A1", "11B2", "12C3")
   - Chọn khối (grade)
   - Chọn năm học (year)
   - Thiết lập sĩ số (capacity)
3. Lưu các lớp học

**Kiểm tra:**
- ✅ Mỗi khối cần tạo lịch phải có ít nhất 1 lớp
- ✅ Lớp học phải thuộc năm học đúng

**API:** `POST /api/classes`

---

### **Bước 3: Tạo và kích hoạt môn học (Subjects)** ✅ BẮT BUỘC

**Mục đích:** Đảm bảo có môn học để xếp vào lịch

**Các thao tác:**
1. Vào **"Quản lý môn học"**
2. Tạo các môn học cần thiết (Toán, Ngữ văn, Anh văn, ...)
3. Đảm bảo `isActive = true` cho các môn học cần sử dụng
4. Lưu môn học

**Kiểm tra:**
- ✅ Có ít nhất 1 môn học được kích hoạt (`isActive !== false`)

**API:** `POST /api/subjects` hoặc `PUT /api/subjects/:id`

---

### **Bước 4: Tạo và kích hoạt hoạt động (Activities)** ⚠️ TÙY CHỌN

**Mục đích:** Thêm các hoạt động vào thời khóa biểu (nếu cần)

**Các thao tác:**
1. Vào **"Quản lý hoạt động"**
2. Tạo các hoạt động (Chào cờ, Sinh hoạt lớp, ...)
3. Đảm bảo `isActive = true` cho các hoạt động cần sử dụng
4. Cấu hình hoạt động trong **"Cấu hình thời khóa biểu"** → **"Số tiết / Môn & Hoạt động"**
5. Lưu hoạt động

**Kiểm tra:**
- ⚠️ Có hoạt động được kích hoạt (khuyến nghị, không bắt buộc)

**API:** `POST /api/activities` hoặc `PUT /api/activities/:id`

---

### **Bước 5: Phân công giảng dạy (TeachingAssignment)** ✅ BẮT BUỘC

**Mục đích:** Phân công giáo viên dạy môn học cho các lớp

**Các thao tác:**
1. Vào **"Phân công giảng dạy"**
2. Chọn năm học và học kỳ
3. Phân công giáo viên cho từng lớp và môn học:
   - Chọn lớp (classId)
   - Chọn môn học (subjectId)
   - Chọn giáo viên (teacherId)
   - Chọn năm học (year)
   - Chọn học kỳ (semester)
4. Lưu phân công

**Hoặc sử dụng "Phân công tự động":**
1. Chọn năm học, học kỳ, khối
2. Chọn phương án: "Xóa phân công cũ và tạo mới" hoặc "Bổ sung phân công mới"
3. Hệ thống sẽ tự động phân công dựa trên:
   - `maxClasses` của giáo viên
   - `maxClassPerGrade` của giáo viên
   - `weeklyLessons` của giáo viên
   - Chuyên môn của giáo viên

**Kiểm tra:**
- ✅ Tất cả các lớp cần tạo lịch phải có phân công giảng dạy
- ✅ Mỗi lớp phải có phân công cho các môn học cần thiết

**API:** `POST /api/teaching-assignments` hoặc `POST /api/teaching-assignments/auto-assign`

---

### **Bước 6: Cấu hình ma trận rảnh cho giáo viên (Teacher.availableMatrix)** ⚠️ KHUYẾN NGHỊ

**Mục đích:** Tối ưu việc xếp lịch dựa trên lịch rảnh của giáo viên

**Các thao tác:**
1. Vào **"Quản lý giáo viên"**
2. Chọn giáo viên cần cấu hình
3. Cấu hình **"Ma trận rảnh"** (availableMatrix):
   - Ma trận 2D: `[day][period]`
   - `true` = giáo viên rảnh, `false` = giáo viên không rảnh
   - Ví dụ: `[[true, true, false, ...], [true, true, true, ...], ...]`
4. Lưu cấu hình

**Kiểm tra:**
- ⚠️ Tất cả giáo viên có phân công nên có ma trận rảnh (khuyến nghị)

**API:** `PUT /api/teachers/:id` với `availableMatrix`

---

### **Bước 7: Kiểm tra ràng buộc (maxClassPerGrade, weeklyLessons)** ⚠️ KHUYẾN NGHỊ

**Mục đích:** Đảm bảo giáo viên không bị quá tải

**Các thao tác:**
1. Vào **"Quản lý giáo viên"**
2. Kiểm tra và cấu hình cho từng giáo viên:
   - **`maxClassPerGrade`**: Số lớp tối đa có thể dạy cho mỗi khối (mặc định: 2 lớp/khối)
   - **`weeklyLessons`**: Số tiết tối đa/tuần (mặc định: 22 tiết/tuần)
   - **`maxClasses`**: Tổng số lớp tối đa có thể dạy (mặc định: 3 lớp)
3. Lưu cấu hình

**Kiểm tra:**
- ⚠️ Đảm bảo phân công không vượt quá các giới hạn trên

**API:** `PUT /api/teachers/:id` với `maxClassPerGrade`, `weeklyLessons`, `maxClasses`

---

### **Bước 8: Kiểm tra tổng số tiết** ⚠️ KHUYẾN NGHỊ

**Mục đích:** Đảm bảo tổng số tiết yêu cầu không vượt quá số tiết có sẵn

**Các thao tác:**
1. Tính tổng số tiết yêu cầu cho mỗi khối:
   - Tổng số tiết/tuần của tất cả môn học
   - Tổng số tiết/tuần của tất cả hoạt động
2. Tính tổng số tiết có sẵn:
   - Tổng số tiết buổi chính (morningPeriods) trong tuần
3. So sánh:
   - Nếu `tổng yêu cầu > tổng có sẵn` → Cần điều chỉnh

**Kiểm tra:**
- ⚠️ Tổng số tiết yêu cầu ≤ Tổng số tiết có sẵn

---

### **Bước 9: Kiểm tra điều kiện trước khi tạo lịch** ✅ BẮT BUỘC

**Mục đích:** Validate tất cả điều kiện trước khi tạo lịch

**Các thao tác:**
1. Gọi API validation:
   ```javascript
   POST /api/auto-schedule/validate
   Body: {
     grades: ["10", "11", "12"],
     year: "2025-2026",
     semester: "HK1"
   }
   ```

2. Kiểm tra kết quả:
   ```json
   {
     "valid": true/false,
     "canGenerate": true/false,
     "hasWarnings": true/false,
     "checks": {
       "scheduleConfig": true/false,
       "classes": true/false,
       "subjects": true/false,
       "activities": true/false,
       "teachingAssignments": true/false,
       "teachers": true/false,
       "constraints": true/false,
       "periods": true/false
     },
     "errors": [...],
     "warnings": [...],
     "summary": {
       "totalErrors": 0,
       "totalWarnings": 0,
       "stepsCompleted": 8,
       "stepsTotal": 8
     }
   }
   ```

3. Xử lý lỗi và cảnh báo:
   - **Errors**: Phải sửa trước khi tạo lịch
   - **Warnings**: Nên xem xét, nhưng vẫn có thể tạo lịch

**Kiểm tra:**
- ✅ `valid === true` và `canGenerate === true` → Sẵn sàng tạo lịch
- ❌ `valid === false` → Cần sửa lỗi trước

---

### **Bước 10: Tự động tạo thời khóa biểu** ✅ BẮT BUỘC

**Mục đích:** Tạo lịch tự động cho tất cả các lớp

**Các thao tác:**
1. Gọi API tạo lịch:
   ```javascript
   POST /api/auto-schedule/generate
   Body: {
     grades: ["10", "11", "12"],
     year: "2025-2026",
     semester: "HK1"
   }
   ```

2. Chờ hệ thống xử lý (có thể mất vài phút nếu có nhiều lớp)

3. Kiểm tra kết quả:
   - Xem báo cáo trong console/log
   - Kiểm tra lịch đã được tạo trong database

**Kiểm tra:**
- ✅ Tất cả các lớp đã có lịch
- ✅ Không có môn học nào thiếu tiết (hoặc có cảnh báo)
- ✅ Không có xung đột giáo viên

---

## 📊 Checklist Trước Khi Tạo Lịch

### ✅ Bắt buộc (Must Have)
- [ ] Có cấu hình thời khóa biểu (ScheduleConfig)
- [ ] Có lớp học cho các khối cần tạo lịch
- [ ] Có môn học được kích hoạt
- [ ] Có phân công giảng dạy cho tất cả các lớp
- [ ] Validation API trả về `valid: true`

### ⚠️ Khuyến nghị (Should Have)
- [ ] Có hoạt động được kích hoạt (nếu cần)
- [ ] Giáo viên có ma trận rảnh (availableMatrix)
- [ ] Cấu hình ràng buộc cho giáo viên (maxClassPerGrade, weeklyLessons)
- [ ] Tổng số tiết yêu cầu ≤ Tổng số tiết có sẵn
- [ ] Validation API không có warnings nghiêm trọng

---

## 🔧 API Endpoints

### 1. Kiểm tra điều kiện
```http
POST /api/auto-schedule/validate
Content-Type: application/json

{
  "grades": ["10", "11", "12"],
  "year": "2025-2026",
  "semester": "HK1"
}
```

### 2. Tạo lịch tự động
```http
POST /api/auto-schedule/generate
Content-Type: application/json

{
  "grades": ["10", "11", "12"],
  "year": "2025-2026",
  "semester": "HK1"
}
```

---

## 📝 Lưu Ý

1. **Thứ tự thực hiện**: Nên thực hiện theo đúng thứ tự từ Bước 1 → Bước 10
2. **Validation**: Luôn gọi API validation trước khi tạo lịch
3. **Xử lý lỗi**: Phải sửa tất cả lỗi (errors) trước khi tạo lịch
4. **Cảnh báo**: Có thể bỏ qua cảnh báo (warnings), nhưng nên xem xét
5. **Performance**: Tạo lịch cho nhiều lớp có thể mất vài phút, cần kiên nhẫn

---

## 🎯 Kết Luận

Sau khi hoàn thành tất cả các bước trên và validation API trả về `valid: true`, hệ thống đã sẵn sàng để tự động tạo thời khóa biểu cho toàn trường.


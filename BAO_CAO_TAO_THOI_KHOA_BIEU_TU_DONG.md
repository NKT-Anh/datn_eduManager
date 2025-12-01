# 📋 BÁO CÁO KIỂM TRA LOGIC TẠO THỜI KHÓA BIỂU TỰ ĐỘNG

## 🎯 TỔNG QUAN

Hệ thống sử dụng thuật toán **Random Placement + Swap Heuristic** để tự động tạo thời khóa biểu cho các lớp học. Logic được triển khai trong `autoScheduleController.js`.

## 📚 KIẾN TRÚC THUẬT TOÁN

### 1. **Random Placement Algorithm**

Khác với tài liệu `AUTO_SCHEDULE_ALGORITHM.md` mô tả CSP + Backtracking, logic thực tế sử dụng:
- **Random placement**: Xếp ngẫu nhiên môn học vào các slot
- **Swap heuristic**: Khi gặp conflict, thử swap với slot trước đó
- **Retry mechanism**: Thử lại toàn bộ quá trình nếu không thành công

### 2. **Quy Trình Xếp Lịch**

#### **Bước 1: Khởi Tạo và Load Dữ Liệu**

```javascript
1. Load dữ liệu:
   - ScheduleConfig (cấu hình thời khóa biểu)
   - Subjects (môn học)
   - Activities (hoạt động)
   - Classes (lớp học)
   - TeachingAssignments (phân công giảng dạy)
   - ClassPeriods (phân bổ số tiết theo lớp - nếu có)

2. Shuffle classes:
   - Xáo trộn ngẫu nhiên thứ tự lớp để tránh thiên vị
   - Mỗi lần retry sẽ shuffle lại

3. Khởi tạo tracking:
   - inMemoryTeacherConflicts: Map để track conflict giáo viên trong memory
   - schedulesInMemory: Lưu tất cả schedules đã tạo (chưa lưu DB)
```

#### **Bước 2: Xếp Hoạt Động (Activities) Trước**

```javascript
1. Lấy danh sách activities từ gradeConfig
2. Với mỗi activity:
   a. Nếu có fixedSlots → xếp vào slot cố định và lock
   b. Nếu không có fixedSlots:
      - Xác định buổi (main/extra) dựa trên activityConfig.session
      - Random placement vào đúng buổi
      - Lock slot sau khi xếp
```

#### **Bước 3: Xếp Môn Học (Subjects)**

```javascript
1. Lấy danh sách subjects từ gradeConfig
2. Với mỗi subject:
   a. Lấy số tiết/tuần (ưu tiên: ClassPeriods > gradeConfig.classPeriods > gradeConfig.periodsPerWeek)
   b. Tìm assignment để lấy giáo viên
   c. Xác định buổi (main/extra) dựa trên subjectConfig.session
   d. Xếp các tiết:
      - Nếu allowConsecutive = true và còn >= 2 tiết:
        * Ưu tiên tìm 2 slot liền kề
        * Nếu không tìm được sau 50 lần thử → fallback về xếp đơn
      - Nếu allowConsecutive = false hoặc chỉ còn 1 tiết:
        * Xếp 1 tiết
      - Tuân thủ maxPeriodsPerDay (số tiết tối đa/ngày)
      - Kiểm tra:
        * Slot trống?
        * Slot không locked?
        * Giáo viên rảnh? (availableMatrix)
        * Không conflict với giáo viên khác? (checkTeacherConflict)
      - Nếu conflict → thử swap với slot trước đó
```

#### **Bước 4: Kiểm Tra và Retry**

```javascript
1. Sau khi tạo lịch cho tất cả lớp:
   - Kiểm tra số lớp thành công
   - Nếu còn lỗi và chưa hết số lần thử → retry toàn bộ
   - Nếu đã hết số lần thử → lưu những gì đã tạo được

2. Retry mechanism:
   - maxGlobalAttempts = 5
   - Mỗi lần retry sẽ shuffle lại classes
   - Reset tất cả tracking maps
```

#### **Bước 5: Lưu Vào Database**

```javascript
1. Với mỗi schedule đã tạo:
   - Xóa lịch cũ (nếu có)
   - Lưu lịch mới vào Schedule collection
   - Cleanup: Xóa field `locked` khỏi timetable
```

## 🔧 CÁC RÀNG BUỘC (CONSTRAINTS)

### 1. **Ràng Buộc Giáo Viên**

- ✅ **Không trùng giáo viên**: Một giáo viên không thể dạy 2 lớp cùng lúc
  - Kiểm tra trong memory (inMemoryTeacherConflicts)
  - Kiểm tra trong database (Schedule.checkTeacherConflict)
  - **Lưu ý**: Trong cùng 1 lớp, giáo viên có thể dạy nhiều tiết (không conflict)

- ✅ **Lịch rảnh**: Giáo viên chỉ có thể dạy trong các slot rảnh (`availableMatrix`)
  - `isTeacherAvailable(teacher, dayIdx, periodIdx)`
  - Nếu không có availableMatrix → mặc định rảnh

### 2. **Ràng Buộc Môn Học**

- ✅ **Max tiết/ngày**: Không vượt quá `maxPeriodsPerDay` cho mỗi môn/ngày
  - Chỉ tính trong buổi tương ứng (main/extra)

- ✅ **Max tiết/buổi**: Không vượt quá `maxPeriodsPerDay` cho mỗi môn/buổi
  - Buổi chính/phụ được xác định từ `gradeConfig.rules.session`

- ✅ **Tiết liên tiếp**: 
  - Nếu `allowConsecutive = true` → Ưu tiên xếp 2 tiết liền kề
  - Nếu `allowConsecutive = false` → Không xếp 2 tiết liền kề

### 3. **Ràng Buộc Thời Gian**

- ✅ **Buổi chính/phụ**: 
  - Môn học có `session = 'main'` → xếp vào buổi chính
  - Môn học có `session = 'extra'` → xếp vào buổi phụ
  - Buổi chính/phụ được xác định từ `gradeConfig.rules.session`:
    - `morning`: Buổi chính = sáng (tiết 1-5), buổi phụ = chiều (tiết 6-10)
    - `afternoon`: Buổi chính = chiều (tiết 6-10), buổi phụ = sáng (tiết 1-5)
    - `both`: Buổi chính = cả ngày (tiết 1-10), buổi phụ = chiều (tiết 6-10)

- ✅ **Tiết nghỉ**: Các tiết trong `gradeConfig.restPeriods` được lock (không xếp môn học)

- ✅ **Fixed slots**: Các môn/hoạt động có `fixedSlots` được xếp vào vị trí cố định và lock

### 4. **Ràng Buộc Phân Bổ**

- ✅ **Shuffle classes**: Xáo trộn ngẫu nhiên thứ tự lớp để tránh thiên vị
- ✅ **Random placement**: Xếp ngẫu nhiên vào các slot (không thiên vị thứ đầu)

## 🔄 SWAP HEURISTIC

### **Khi Gặp Conflict**

```javascript
trySwapToResolveConflict():
  1. Tìm các slot trước đó (tiết < conflictPeriodIdx) trong cùng ngày
  2. Với mỗi slot trước đó:
     a. Nếu slot trống:
        - Kiểm tra giáo viên A có conflict ở slot trước không
        - Nếu không → di chuyển giáo viên A vào slot trước
        - Slot conflict giờ trống → gán giáo viên A vào
     b. Nếu slot có giáo viên B:
        - Kiểm tra giáo viên A có conflict ở slot B không
        - Kiểm tra giáo viên B có conflict ở slot A không
        - Nếu cả 2 đều không conflict → Swap A ↔ B
  3. Nếu không tìm được slot để swap → return false
```

## 📊 NGUỒN DỮ LIỆU SỐ TIẾT

### **Ưu Tiên 1: ClassPeriods (Phân Bổ Theo Lớp)**

```javascript
// Nếu năm học - học kỳ đó đã có classPeriods
classPeriods[classId].subjectPeriods[subjectId] → periodsPerWeek
classPeriods[classId].activityPeriods[activityId] → periodsPerWeek
```

### **Ưu Tiên 2: GradeConfigs.classPeriods (Theo Lớp Trong Config)**

```javascript
// Nếu chưa có classPeriods, lấy từ gradeConfig
gradeConfigs[grade].subjects[subjectId].classPeriods[classId] → periodsPerWeek
```

### **Ưu Tiên 3: GradeConfigs.periodsPerWeek (Mặc Định)**

```javascript
// Cuối cùng: Lấy từ periodsPerWeek mặc định
gradeConfigs[grade].subjects[subjectId].periodsPerWeek
```

## ⚠️ VẤN ĐỀ PHÁT HIỆN

### 1. **Không Sử Dụng CSP/Backtracking Như Tài Liệu**

- **Tài liệu** (`AUTO_SCHEDULE_ALGORITHM.md`) mô tả sử dụng CSP + Backtracking + MRV/LCV heuristic
- **Thực tế**: Logic sử dụng Random Placement + Swap Heuristic
- **Khuyến nghị**: 
  - Cập nhật tài liệu để phản ánh đúng logic thực tế
  - Hoặc triển khai lại theo tài liệu (CSP + Backtracking) để có giải pháp tối ưu hơn

### 2. **Random Placement Có Thể Không Tối Ưu**

- Logic hiện tại xếp ngẫu nhiên, có thể không tìm được giải pháp tối ưu
- **Khuyến nghị**: 
  - Có thể thêm heuristic để ưu tiên slot tốt hơn (ví dụ: slot có ít conflict hơn)
  - Hoặc sử dụng CSP + Backtracking như tài liệu mô tả

### 3. **Retry Mechanism Có Thể Tốn Thời Gian**

- Nếu không tìm được giải pháp, sẽ retry toàn bộ quá trình (tối đa 5 lần)
- **Khuyến nghị**: 
  - Có thể cải thiện bằng cách chỉ retry các lớp lỗi, không retry toàn bộ
  - Hoặc sử dụng backtracking để tìm giải pháp tốt hơn

### 4. **Swap Heuristic Có Thể Không Đủ**

- Swap chỉ thử với slot trước đó trong cùng ngày
- **Khuyến nghị**: 
  - Có thể mở rộng swap sang các ngày khác
  - Hoặc sử dụng backtracking để tìm giải pháp tốt hơn

### 5. **Chưa Kiểm Tra Một Số Ràng Buộc**

- Chưa kiểm tra `maxPeriodsPerDay` cho cả buổi (chỉ kiểm tra trong buổi tương ứng)
- Chưa kiểm tra phân bổ đều các môn vào các thứ (chỉ random)
- **Khuyến nghị**: 
  - Thêm kiểm tra `maxPeriodsPerDay` cho cả buổi
  - Thêm logic phân bổ đều (round-robin) như tài liệu mô tả

### 6. **Logic Xếp Liền Kề Có Thể Cải Thiện**

- Hiện tại: Ưu tiên tìm 2 slot liền kề, nếu không tìm được sau 50 lần thử → fallback
- **Khuyến nghị**: 
  - Có thể tăng số lần thử hoặc mở rộng phạm vi tìm kiếm
  - Hoặc sử dụng backtracking để tìm giải pháp tốt hơn

## ✅ ĐIỂM MẠNH

1. **Logic đơn giản, dễ hiểu**: Random placement dễ triển khai và debug
2. **Swap heuristic**: Giúp giải quyết một số conflict mà không cần retry toàn bộ
3. **Retry mechanism**: Đảm bảo tạo được lịch cho nhiều lớp nhất có thể
4. **Shuffle classes**: Tránh thiên vị theo thứ tự lớp
5. **Kiểm tra đầy đủ ràng buộc giáo viên**: Không trùng giáo viên, kiểm tra lịch rảnh
6. **Hỗ trợ ClassPeriods**: Cho phép phân bổ số tiết theo từng lớp cụ thể

## 📝 KHUYẾN NGHỊ CẢI THIỆN

### 1. **Cải Thiện Thuật Toán**

- ⚠️ **Triển khai CSP + Backtracking** như tài liệu mô tả:
  - Sử dụng MRV (Minimum Remaining Values) để chọn biến
  - Sử dụng LCV (Least Constraining Value) để chọn giá trị
  - Backtracking để tìm giải pháp tối ưu

- ⚠️ **Hoặc cải thiện Random Placement**:
  - Thêm heuristic để ưu tiên slot tốt hơn
  - Tính điểm ràng buộc (constraint score) cho mỗi slot
  - Ưu tiên slot có score thấp nhất

### 2. **Cải Thiện Swap Heuristic**

- Mở rộng phạm vi swap: Không chỉ slot trước đó, mà cả các slot khác trong tuần
- Swap nhiều bước: Thử swap A→B, B→C, C→D để giải quyết conflict

### 3. **Cải Thiện Retry Mechanism**

- Chỉ retry các lớp lỗi, không retry toàn bộ
- Lưu lại các lớp đã thành công, chỉ tạo lại các lớp lỗi

### 4. **Thêm Kiểm Tra Ràng Buộc**

- Kiểm tra `maxPeriodsPerDay` cho cả buổi
- Thêm logic phân bổ đều (round-robin) như tài liệu mô tả
- Kiểm tra phân bổ đều các môn vào các thứ

### 5. **Cải Thiện Logic Xếp Liền Kề**

- Tăng số lần thử hoặc mở rộng phạm vi tìm kiếm
- Sử dụng backtracking để tìm giải pháp tốt hơn

## 📚 SO SÁNH VỚI TÀI LIỆU

| Tính năng | Tài liệu (AUTO_SCHEDULE_ALGORITHM.md) | Thực tế (autoScheduleController.js) |
|-----------|--------------------------------------|-------------------------------------|
| **Thuật toán** | CSP + Backtracking | Random Placement + Swap |
| **Heuristic** | MRV + LCV | Không có (chỉ random) |
| **Constraint Score** | Có (tính điểm ràng buộc) | Không có |
| **Phân bổ đều** | Có (round-robin) | Không (chỉ random) |
| **Swap** | Không mô tả | Có (swap với slot trước đó) |
| **Retry** | Không mô tả | Có (retry toàn bộ, tối đa 5 lần) |

## 🎯 KẾT LUẬN

Logic hiện tại **hoạt động được** nhưng **không tối ưu** như tài liệu mô tả. Có 2 hướng cải thiện:

1. **Triển khai lại theo tài liệu** (CSP + Backtracking): Tối ưu hơn, nhưng phức tạp hơn
2. **Cải thiện logic hiện tại** (Random Placement): Đơn giản hơn, nhưng cần thêm heuristic để tối ưu

Khuyến nghị: **Triển khai lại theo tài liệu** để có giải pháp tối ưu và đảm bảo tìm được giải pháp trong mọi trường hợp.


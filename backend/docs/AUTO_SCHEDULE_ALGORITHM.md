# 📚 Thuật Toán Tự Động Xếp Thời Khóa Biểu

## 🎯 Tổng Quan

Hệ thống sử dụng thuật toán **CSP (Constraint Satisfaction Problem)** kết hợp với **Backtracking** và các **Heuristic** để tự động tạo thời khóa biểu cho các lớp học.

## 🔧 Kiến Trúc Thuật Toán

### 1. **CSP (Constraint Satisfaction Problem)**

Mỗi bài toán xếp lịch được mô hình hóa như một CSP:
- **Biến (Variables)**: Mỗi môn học/hoạt động cần xếp số tiết/tuần
- **Giá trị (Values)**: Các slot thời gian (ngày + tiết) có thể xếp
- **Ràng buộc (Constraints)**: Các quy tắc phải tuân thủ

### 2. **Backtracking Algorithm**

Sử dụng backtracking để tìm giải pháp:
- Thử xếp từng môn vào các slot có thể
- Nếu vi phạm ràng buộc → backtrack và thử slot khác
- Tiếp tục cho đến khi tìm thấy giải pháp hoặc không có giải pháp

### 3. **Heuristic Functions**

#### 3.1. **MRV (Minimum Remaining Values)**
- Chọn biến (môn học) có ít giá trị còn lại nhất
- Ưu tiên môn học còn nhiều tiết chưa xếp nhất
- Ưu tiên môn học trước hoạt động

#### 3.2. **LCV (Least Constraining Value)**
- Chọn slot có ít ràng buộc nhất
- Tính điểm ràng buộc (constraint score) cho mỗi slot
- Slot có score thấp nhất → ưu tiên xếp trước

## 📋 Các Ràng Buộc (Constraints)

### 1. **Ràng Buộc Giáo Viên**
- ✅ Không trùng giáo viên: Một giáo viên không thể dạy 2 lớp cùng lúc
- ✅ Lịch rảnh: Giáo viên chỉ có thể dạy trong các slot rảnh (`availableMatrix`)
- ✅ Số lớp tối đa: Giáo viên không vượt quá `maxClassPerGrade` cho mỗi khối
- ✅ Số tiết/tuần: Giáo viên không vượt quá `weeklyLessons`

### 2. **Ràng Buộc Môn Học (Khi Không Có Giáo Viên)**
- ✅ Tránh trùng môn: Cố gắng làm các lớp có thời khóa biểu khác nhau
- ✅ Vẫn xếp môn: Nếu không có giáo viên, vẫn xếp môn đó vào (không block)

### 3. **Ràng Buộc Thời Gian**
- ✅ Buổi chính/phụ: Môn học chính xếp vào buổi chính, môn phụ xếp vào buổi trái
- ✅ Max tiết/ngày: Không vượt quá `maxPeriodsPerDay` cho mỗi môn/ngày
- ✅ Max tiết/buổi: Không vượt quá `maxPeriodsPerDay` cho mỗi môn/buổi
- ✅ Tiết liên tiếp: Nếu `allowConsecutive = false`, không xếp 2 tiết liên tiếp
- ✅ Tiết liên tiếp (ưu tiên): Nếu `allowConsecutive = true`, ưu tiên xếp liên tiếp

### 4. **Ràng Buộc Cố Định**
- ✅ Fixed slots: Các môn/hoạt động có `fixedSlots` được xếp vào vị trí cố định trước
- ✅ Không conflict fixed slots: Không cho phép 2 môn/hoạt động trùng slot cố định

### 5. **Ràng Buộc Phân Bổ**
- ✅ Phân bổ đều: Không thiên vị môn vào các thứ đầu tuần
- ✅ Sử dụng round-robin để phân bổ số tiết dư đều đặn

## 🔄 Quy Trình Xếp Lịch

### **Bước 1: Khởi Tạo**

```javascript
1. Load dữ liệu:
   - ScheduleConfig (cấu hình thời khóa biểu)
   - Subjects (môn học)
   - Activities (hoạt động)
   - Classes (lớp học)
   - TeachingAssignments (phân công giảng dạy)
   - ClassPeriods (phân bổ số tiết theo lớp - nếu có)

2. Khởi tạo AutoScheduleGenerator:
   - Cache classPeriods từ API
   - Khởi tạo teacherAvailability (ma trận rảnh)
   - Khởi tạo teacherInfo (thông tin giáo viên)
   - Khởi tạo tracking counters
```

### **Bước 2: Xếp Cố Định (Fixed Slots)**

```javascript
1. Kiểm tra conflict giữa các fixedSlots
2. Xếp các môn/hoạt động có fixedSlots vào timetable
3. Đánh dấu các slot đã cố định
```

### **Bước 3: Xếp Linh Hoạt (CSP Solver)**

```javascript
1. Tạo danh sách biến (variables):
   - Mỗi môn/hoạt động = 1 biến
   - Mỗi biến có: item, teacher, periodsRemaining, periodsPlaced, placedSlots

2. Backtracking với heuristic:
   a. MRV: Chọn môn còn nhiều tiết chưa xếp nhất
   b. LCV: Chọn slot có ít ràng buộc nhất
   c. Thử xếp vào slot đó
   d. Nếu thành công → recursive backtracking
   e. Nếu thất bại → backtrack và thử slot khác
```

### **Bước 4: Lấy Số Tiết Cho Lớp**

```javascript
getPeriodsForClass(item, classId):
  1. Ưu tiên: Lấy từ classPeriods (nếu có cho năm học - học kỳ này)
  2. Fallback: Lấy từ gradeConfigs (cấu hình thời khóa biểu)
```

## 🧮 Công Thức Tính Điểm Ràng Buộc (LCV Score)

```javascript
score = 0

// Nếu có giáo viên
if (teacher.id) {
  if (!isTeacherAvailable) score += 1000
  if (!canTeacherTakeMoreLessons) score += 500
}
// Nếu không có giáo viên
else {
  conflictCount = countSubjectConflict(...)
  score += conflictCount * 50  // Giảm penalty để vẫn có thể xếp
}

// Kiểm tra liên tiếp (nếu không cho phép)
if (!allowConsecutive && hasConsecutive) score += 200

// Ưu tiên slot liên tiếp (nếu cho phép)
if (allowConsecutive && isConsecutive) score -= 50

// Phân bổ đều: ngày có ít môn hơn → score thấp hơn
score += periodsInDay * 10

// Không thiên vị thứ đầu
score += dayIndex * 0.1

return score  // Score thấp hơn = ít ràng buộc hơn → ưu tiên
```

## 📊 Xử Lý Buổi Chính/Phụ

### **Xác Định Buổi Chính và Buổi Phụ**

Dựa trên `gradeSessionRules` trong `gradeConfigs`:

```javascript
// Khối học sáng (morning)
- Môn chính (main) → Tiết 1-5 (sáng)
- Môn phụ (extra) → Tiết 6-10 (chiều - buổi trái)

// Khối học chiều (afternoon)
- Môn chính (main) → Tiết 6-10 (chiều)
- Môn phụ (extra) → Tiết 1-5 (sáng - buổi trái)

// Khối học cả ngày (both)
- Môn chính (main) → Tiết 1-10 (cả ngày)
- Môn phụ (extra) → Tiết 6-10 (chiều)
```

## 🎲 Phân Bổ Đều (Không Thiên Vị)

### **Tính Số Tiết Mỗi Ngày**

```javascript
calculatePeriodsPerDay(totalPeriods, totalDays):
  basePeriods = floor(totalPeriods / totalDays)
  extraPeriods = totalPeriods % totalDays
  
  distribution = [basePeriods, basePeriods, ...]  // Mỗi ngày basePeriods
  
  // Phân bổ số tiết dư bằng round-robin (không thiên vị thứ đầu)
  step = max(1, floor(totalDays / extraPeriods))
  for i in range(extraPeriods):
    idx = (i * step) % totalDays
    distribution[idx]++
  
  return distribution
```

### **Shuffle Slots**

```javascript
// Sử dụng Fisher-Yates shuffle để không thiên vị
shuffleArray(slots):
  for i from length-1 down to 1:
    j = random(0, i)
    swap(slots[i], slots[j])
  return slots
```

## 🔍 Kiểm Tra Ràng Buộc (Validation)

### **isValidAssignment(slot, item, teacher, classObj, timetable, placedSlots)**

```javascript
1. ✅ Slot đã có môn học? → false
2. ✅ Slot đã cố định? → false
3. ✅ Có giáo viên?
   - isTeacherAvailable? → false nếu không
   - canTeacherTakeMoreLessons? → false nếu không
4. ✅ Không có giáo viên?
   - Vẫn cho phép xếp (không block)
5. ✅ allowConsecutive = false?
   - hasConsecutivePeriod? → false nếu có
6. ✅ maxPeriodsPerDay?
   - periodsInDay >= maxPeriodsPerDay? → false
7. ✅ maxPeriodsPerDay/buổi?
   - periodsInMainSession >= maxPeriodsPerDay? → false

return true  // Hợp lệ
```

## 📈 Ưu Tiên Xếp Liên Tiếp

### **Khi `allowConsecutive = true`**

```javascript
1. Tách slots thành 2 nhóm:
   - consecutiveSlots: Slot liên tiếp với slot đã xếp
   - otherSlots: Các slot khác

2. Shuffle mỗi nhóm để không thiên vị

3. Ưu tiên xếp consecutiveSlots trước

4. Trong LCV score:
   - Nếu là slot liên tiếp → score -= 50 (ưu tiên)
```

## 🗂️ Nguồn Dữ Liệu Số Tiết

### **Ưu Tiên 1: ClassPeriods (Phân Bổ Theo Lớp)**

```javascript
// Nếu năm học - học kỳ đó đã có classPeriods
classPeriods[classId].subjectPeriods[subjectId] → periodsPerWeek
classPeriods[classId].activityPeriods[activityId] → periodsPerWeek
```

### **Ưu Tiên 2: GradeConfigs (Cấu Hình Mặc Định)**

```javascript
// Nếu chưa có classPeriods, lấy từ cấu hình thời khóa biểu
gradeConfigs[grade].subjects[subjectId].periodsPerWeek
gradeConfigs[grade].activities[activityIndex].periodsPerWeek
```

## 🎯 Mục Tiêu Thuật Toán

1. ✅ **Độ chính xác**: Tôn trọng tất cả ràng buộc
2. ✅ **Không thiên vị**: Phân bổ đều các môn vào các thứ
3. ✅ **Tối ưu**: Cố gắng làm các lớp có thời khóa biểu khác nhau
4. ✅ **Linh hoạt**: Xếp được cả môn có và không có giáo viên
5. ✅ **Ưu tiên môn học**: Môn học được xếp trước hoạt động
6. ✅ **Xếp liên tiếp**: Môn cho phép liên tiếp được xếp liên tiếp

## 📝 Ví Dụ Minh Họa

### **Ví dụ 1: Xếp môn Toán (4 tiết/tuần, có giáo viên)**

```
1. MRV: Chọn Toán (còn 4 tiết chưa xếp)
2. LCV: Tính score cho các slot có thể:
   - Monday tiết 1: score = 10 (ngày có 0 môn)
   - Monday tiết 2: score = 10
   - Tuesday tiết 1: score = 10
   - ...
3. Chọn slot có score thấp nhất: Monday tiết 1
4. Kiểm tra ràng buộc:
   - Giáo viên rảnh? ✅
   - Không trùng lớp khác? ✅
   - Không vượt maxPeriodsPerDay? ✅
5. Xếp vào Monday tiết 1
6. Tiếp tục với 3 tiết còn lại...
```

### **Ví dụ 2: Xếp môn không có giáo viên**

```
1. MRV: Chọn môn (còn X tiết chưa xếp)
2. LCV: Tính score cho các slot:
   - Nếu slot đã có lớp khác xếp môn này → score += 50
   - Vẫn cho phép xếp (không block)
3. Chọn slot có score thấp nhất
4. Xếp vào slot đó
```

## 🔧 Tối Ưu Hóa

1. **Cache Teacher Conflicts**: Sử dụng `teacherConflictCache` để tránh kiểm tra lại
2. **Early Termination**: Dừng sớm nếu tìm thấy giải pháp
3. **Heuristic Ordering**: Sắp xếp biến và giá trị theo heuristic để tìm giải pháp nhanh hơn
4. **Shuffle để tránh thiên vị**: Không luôn chọn slot đầu tiên

## ⚠️ Xử Lý Lỗi

1. **Không tìm thấy giải pháp**: Log cảnh báo và báo cáo số tiết đã xếp
2. **Thiếu giáo viên**: Vẫn xếp môn (với teacher = "Chưa phân công")
3. **Conflict fixed slots**: Bỏ qua slot conflict và log cảnh báo
4. **Vượt quá ràng buộc**: Bỏ qua và thử slot khác

## 📚 Tài Liệu Tham Khảo

- **CSP (Constraint Satisfaction Problem)**: https://en.wikipedia.org/wiki/Constraint_satisfaction_problem
- **Backtracking Algorithm**: https://en.wikipedia.org/wiki/Backtracking
- **MRV Heuristic**: Minimum Remaining Values - chọn biến có ít giá trị còn lại nhất
- **LCV Heuristic**: Least Constraining Value - chọn giá trị ít ràng buộc nhất







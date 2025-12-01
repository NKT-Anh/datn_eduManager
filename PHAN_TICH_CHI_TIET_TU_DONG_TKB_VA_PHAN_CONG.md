# 📚 PHÂN TÍCH CHI TIẾT: TỰ ĐỘNG CHIA THỜI KHÓA BIỂU & PHÂN CÔNG GIẢNG DẠY

**Ngày phân tích:** $(date)  
**Hệ thống:** Quản lý trường học THPT

---

## 📋 MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Phân công giảng dạy tự động](#2-phân-công-giảng-dạy-tự-động)
3. [Tự động xếp thời khóa biểu](#3-tự-động-xếp-thời-khóa-biểu)
4. [Luồng xử lý chi tiết](#4-luồng-xử-lý-chi-tiết)
5. [Các ràng buộc và điều kiện](#5-các-ràng-buộc-và-điều-kiện)
6. [Thuật toán và heuristic](#6-thuật-toán-và-heuristic)
7. [Ví dụ minh họa](#7-ví-dụ-minh-họa)

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                    HỆ THỐNG TỰ ĐỘNG                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │  PHÂN CÔNG GIẢNG DẠY  │ ────▶│  XẾP THỜI KHÓA BIỂU  │    │
│  │      TỰ ĐỘNG          │      │       TỰ ĐỘNG        │    │
│  └──────────────────────┘      └──────────────────────┘    │
│           │                              │                  │
│           │                              │                  │
│           ▼                              ▼                  │
│  ┌──────────────────────────────────────────────────┐      │
│  │         DATABASE (MongoDB)                        │      │
│  │  - TeachingAssignment                            │      │
│  │  - Schedule                                       │      │
│  │  - Teacher, Class, Subject                       │      │
│  └──────────────────────────────────────────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2. Thứ tự thực hiện

```
Bước 1: Phân công giảng dạy tự động
   ↓
Bước 2: Xếp thời khóa biểu tự động
```

**Lý do:** Phải có phân công giảng dạy trước khi xếp lịch, vì lịch cần biết giáo viên nào dạy môn nào ở lớp nào.

---

## 2. PHÂN CÔNG GIẢNG DẠY TỰ ĐỘNG

### 2.1. Mục đích

Tự động phân công giáo viên dạy môn học cho các lớp dựa trên:
- Chuyên môn của giáo viên
- Khả năng dạy khối lớp
- Tải giảng viên hiện tại
- Các ràng buộc (maxClasses, maxClassPerGrade, weeklyLessons)

### 2.2. Luồng xử lý chi tiết

```
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 1: KHỞI TẠO                                            │
├─────────────────────────────────────────────────────────────┤
│  1. Load dữ liệu:                                           │
│     - Classes (lớp học)                                     │
│     - Subjects (môn học)                                    │
│     - Teachers (giáo viên)                                  │
│     - ExistingAssignments (phân công hiện có)               │
│     - ScheduleConfig (cấu hình)                             │
│                                                              │
│  2. Lọc lớp theo khối (grades)                              │
│                                                              │
│  3. Khởi tạo tracking maps:                                │
│     - teacherLoadMap: Số lớp mỗi giáo viên                  │
│     - teacherWeeklyLessonsMap: Số tiết/tuần mỗi giáo viên  │
│     - teacherSubjectLessonsMap: Số tiết/môn                │
│     - teacherSubjectGradeCountMap: Số lớp/môn/khối         │
│     - teacherGradeCountMap: Số lớp/khối                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 2: TÍNH TẢI HIỆN TẠI                                  │
├─────────────────────────────────────────────────────────────┤
│  Duyệt qua existingAssignments (cùng năm học, học kỳ):    │
│                                                              │
│  For each assignment:                                        │
│    1. Cập nhật teacherLoadMap[teacherId]++                  │
│    2. Tính periodsPerWeek = getSubjectPeriodsPerWeek()     │
│    3. Cập nhật teacherWeeklyLessonsMap[teacherId]          │
│    4. Cập nhật teacherSubjectLessonsMap[teacherId][subject] │
│    5. Cập nhật teacherSubjectGradeCountMap                 │
│    6. Cập nhật teacherGradeCountMap                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 3: TẠO TASKS (LỚP + MÔN)                              │
├─────────────────────────────────────────────────────────────┤
│  For each class:                                            │
│    For each subject (phù hợp với khối lớp):                 │
│      If (chưa có phân công):                                │
│        tasks.push({ classId, subjectId, ... })             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 4: XỬ LÝ TỪNG TASK                                    │
├─────────────────────────────────────────────────────────────┤
│  For each task:                                             │
│                                                              │
│    ┌──────────────────────────────────────────┐            │
│    │  Nếu học kỳ 2:                           │            │
│    │    Ưu tiên giáo viên đã dạy ở HK1        │            │
│    │    (nếu vẫn thỏa mãn ràng buộc)          │            │
│    └──────────────────────────────────────────┘            │
│                                                              │
│    ┌──────────────────────────────────────────┐            │
│    │  Tìm candidate teachers:                 │            │
│    │    1. Loại bỏ BGH (isLeader = true)      │            │
│    │    2. Chỉ giáo viên active                │            │
│    │    3. Có môn học này trong subjects      │            │
│    │    4. Được phân quyền dạy khối này       │            │
│    └──────────────────────────────────────────┘            │
│                                                              │
│    ┌──────────────────────────────────────────┐            │
│    │  Lọc theo ràng buộc:                     │            │
│    │    1. Không trùng lặp phân công          │            │
│    │    2. Kiểm tra weeklyLessons             │            │
│    │    3. Kiểm tra maxClasses                │            │
│    │    4. Kiểm tra maxClassPerGrade          │            │
│    └──────────────────────────────────────────┘            │
│                                                              │
│    ┌──────────────────────────────────────────┐            │
│    │  Chọn giáo viên:                         │            │
│    │    Ưu tiên 1: Số tiết/tuần còn lại      │            │
│    │    Ưu tiên 2: Số lớp ít nhất             │            │
│    │    Ưu tiên 3: Cân bằng số tiết/môn       │            │
│    │    Ưu tiên 4: Chia đều theo khối         │            │
│    └──────────────────────────────────────────┘            │
│                                                              │
│    ┌──────────────────────────────────────────┐            │
│    │  Tạo phân công mới:                       │            │
│    │    newAssignments.push({                  │            │
│    │      teacherId, subjectId, classId,      │            │
│    │      year, semester                       │            │
│    │    })                                     │            │
│    │                                           │            │
│    │  Cập nhật tracking maps                  │            │
│    └──────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 5: LƯU VÀO DATABASE                                   │
├─────────────────────────────────────────────────────────────┤
│  1. Kiểm tra trùng lặp trong DB                             │
│  2. Lọc bỏ các phân công trùng lặp                           │
│  3. insertMany(newAssignments)                              │
│  4. Cập nhật teacher.classIds (nếu cần)                     │
│  5. Trả về kết quả                                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.3. Các ràng buộc phân công

#### 2.3.1. Ràng buộc giáo viên

```javascript
// 1. Giáo viên phải có môn học này
teacher.subjects.some(s => s.subjectId === subjectId)

// 2. Giáo viên phải được phân quyền dạy khối này
teacher.subjects.some(s => 
  s.subjectId === subjectId && 
  s.grades.includes(classGrade)
)

// 3. Không vượt quá weeklyLessons
currentWeeklyLessons + periodsPerWeek <= teacher.effectiveWeeklyLessons

// 4. Không vượt quá maxClasses
currentLoad < teacher.maxClasses

// 5. Không vượt quá maxClassPerGrade
currentGradeCount < teacher.maxClassPerGrade[grade]
```

#### 2.3.2. Ưu tiên chọn giáo viên

```javascript
// Thứ tự ưu tiên:
1. Số tiết/tuần còn lại nhiều nhất
   → Chọn giáo viên có nhiều tiết trống nhất

2. Số lớp ít nhất
   → Cân bằng tải giữa các giáo viên

3. Cân bằng số tiết/môn
   → Tránh một giáo viên dạy quá nhiều tiết một môn

4. Chia đều theo khối
   → Tránh dồn nhiều giáo viên cùng môn vào một khối
```

### 2.4. Ví dụ minh họa

**Tình huống:**
- Lớp: 10A1
- Môn: Toán (4 tiết/tuần)
- Giáo viên có thể dạy:
  - GV1: Đang dạy 2 lớp, 15 tiết/tuần, maxClasses = 3, weeklyLessons = 19
  - GV2: Đang dạy 1 lớp, 10 tiết/tuần, maxClasses = 3, weeklyLessons = 19
  - GV3: Đang dạy 3 lớp, 18 tiết/tuần, maxClasses = 3, weeklyLessons = 19

**Tính toán:**
```
GV1: 
  - Số lớp còn lại: 3 - 2 = 1 ✅
  - Số tiết còn lại: 19 - 15 = 4 ✅
  - Có thể nhận: ✅

GV2:
  - Số lớp còn lại: 3 - 1 = 2 ✅
  - Số tiết còn lại: 19 - 10 = 9 ✅
  - Có thể nhận: ✅

GV3:
  - Số lớp còn lại: 3 - 3 = 0 ❌
  - Không thể nhận: ❌
```

**Kết quả:** Chọn GV2 vì có nhiều tiết trống hơn (9 > 4).

---

## 3. TỰ ĐỘNG XẾP THỜI KHÓA BIỂU

### 3.1. Mục đích

Tự động xếp các môn học và hoạt động vào các slot thời gian (ngày + tiết) dựa trên:
- Phân công giảng dạy
- Lịch rảnh của giáo viên (availableMatrix)
- Các ràng buộc thời gian
- Các ràng buộc phân bổ

### 3.2. Thuật toán: CSP + Backtracking

#### 3.2.1. Mô hình CSP

```
Variables (Biến): Mỗi môn học/hoạt động cần xếp
  - item: Subject hoặc Activity
  - teacher: Giáo viên được phân công
  - periodsRemaining: Số tiết còn lại chưa xếp
  - periodsPlaced: Số tiết đã xếp
  - placedSlots: Danh sách slot đã xếp

Values (Giá trị): Các slot thời gian có thể xếp
  - day: Thứ trong tuần (Monday, Tuesday, ...)
  - period: Tiết học (1, 2, 3, ...)
  - session: Buổi (morning, afternoon)

Constraints (Ràng buộc):
  - Không trùng giáo viên
  - Giáo viên chỉ dạy trong slot rảnh
  - Không vượt maxPeriodsPerDay
  - Phân bổ đều
  - ...
```

#### 3.2.2. Heuristic Functions

**MRV (Minimum Remaining Values):**
```javascript
// Chọn môn học còn nhiều tiết chưa xếp nhất
function selectNextVariable(variables) {
  return variables
    .filter(v => v.periodsRemaining > 0)
    .sort((a, b) => {
      // Ưu tiên môn học trước hoạt động
      if (a.item.type === 'subject' && b.item.type === 'activity') return -1;
      if (a.item.type === 'activity' && b.item.type === 'subject') return 1;
      
      // Ưu tiên môn còn nhiều tiết hơn
      return b.periodsRemaining - a.periodsRemaining;
    })[0];
}
```

**LCV (Least Constraining Value):**
```javascript
// Tính điểm ràng buộc cho mỗi slot
function calculateLCVScore(slot, item, teacher, timetable) {
  let score = 0;
  
  // Nếu có giáo viên
  if (teacher.id) {
    // Giáo viên không rảnh → penalty cao
    if (!isTeacherAvailable(teacher, slot)) {
      score += 1000;
    }
    
    // Giáo viên không thể nhận thêm tiết → penalty
    if (!canTeacherTakeMoreLessons(teacher)) {
      score += 500;
    }
  }
  
  // Nếu không có giáo viên
  else {
    // Đếm số lớp khác đã xếp môn này vào slot này
    const conflictCount = countSubjectConflict(slot, item, timetable);
    score += conflictCount * 50; // Penalty nhẹ hơn
  }
  
  // Kiểm tra liên tiếp (nếu không cho phép)
  if (!item.allowConsecutive && hasConsecutivePeriod(slot, item)) {
    score += 200;
  }
  
  // Ưu tiên slot liên tiếp (nếu cho phép)
  if (item.allowConsecutive && isConsecutiveSlot(slot, item)) {
    score -= 50; // Bonus
  }
  
  // Phân bổ đều: ngày có ít môn hơn → score thấp hơn
  const periodsInDay = countPeriodsInDay(timetable, slot.day);
  score += periodsInDay * 10;
  
  // Không thiên vị thứ đầu
  score += dayIndex * 0.1;
  
  return score; // Score thấp hơn = ít ràng buộc hơn → ưu tiên
}
```

### 3.3. Luồng xử lý chi tiết

```
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 1: KHỞI TẠO                                            │
├─────────────────────────────────────────────────────────────┤
│  1. Load dữ liệu:                                           │
│     - ScheduleConfig (cấu hình)                             │
│     - Classes (lớp học)                                     │
│     - Subjects (môn học)                                     │
│     - Activities (hoạt động)                                 │
│     - TeachingAssignments (phân công)                        │
│     - ClassPeriods (phân bổ số tiết)                         │
│                                                              │
│  2. Khởi tạo:                                                │
│     - Cache classPeriods                                     │
│     - Khởi tạo teacherAvailability (ma trận rảnh)           │
│     - Khởi tạo teacherInfo                                   │
│     - Khởi tạo tracking counters                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 2: XẾP CỐ ĐỊNH (FIXED SLOTS)                          │
├─────────────────────────────────────────────────────────────┤
│  For each item (subject/activity) có fixedSlots:            │
│    1. Kiểm tra conflict giữa các fixedSlots                │
│    2. Xếp vào timetable tại vị trí cố định                 │
│    3. Đánh dấu slot đã cố định                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 3: TẠO DANH SÁCH BIẾN (VARIABLES)                      │
├─────────────────────────────────────────────────────────────┤
│  For each class:                                            │
│    For each subject/activity:                               │
│      periodsPerWeek = getPeriodsForClass(item, classId)    │
│      variables.push({                                        │
│        item,                                                 │
│        teacher: getTeacherFromAssignment(),                  │
│        periodsRemaining: periodsPerWeek,                    │
│        periodsPlaced: 0,                                    │
│        placedSlots: []                                      │
│      })                                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 4: BACKTRACKING SOLVER                                │
├─────────────────────────────────────────────────────────────┤
│  function backtrack(variables, timetable):                   │
│                                                              │
│    // Base case: Tất cả môn đã xếp xong                     │
│    if (all variables.periodsRemaining === 0):               │
│      return timetable                                        │
│                                                              │
│    // MRV: Chọn biến tiếp theo                              │
│    variable = selectNextVariable(variables)                  │
│                                                              │
│    // LCV: Tính score cho các slot có thể                    │
│    availableSlots = getAvailableSlots(timetable)           │
│    scoredSlots = availableSlots.map(slot => ({              │
│      slot,                                                  │
│      score: calculateLCVScore(slot, variable)               │
│    }))                                                      │
│    scoredSlots.sort((a, b) => a.score - b.score)           │
│                                                              │
│    // Thử xếp vào từng slot (theo thứ tự score)             │
│    for (scoredSlot of scoredSlots):                         │
│      if (isValidAssignment(scoredSlot.slot, variable)):    │
│        // Xếp vào slot                                      │
│        timetable[scoredSlot.slot.day][scoredSlot.slot.period] = {
│          item: variable.item,                               │
│          teacher: variable.teacher                          │
│        }                                                     │
│        variable.periodsPlaced++                            │
│        variable.periodsRemaining--                          │
│        variable.placedSlots.push(scoredSlot.slot)           │
│                                                              │
│        // Recursive: Tiếp tục với biến tiếp theo            │
│        result = backtrack(variables, timetable)              │
│        if (result !== null):                                │
│          return result                                      │
│                                                              │
│        // Backtrack: Nếu không thành công, bỏ xếp           │
│        timetable[scoredSlot.slot.day][scoredSlot.slot.period] = null
│        variable.periodsPlaced--                             │
│        variable.periodsRemaining++                          │
│        variable.placedSlots.pop()                           │
│                                                              │
│    // Không tìm thấy giải pháp                              │
│    return null                                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 5: KIỂM TRA VÀ LƯU                                    │
├─────────────────────────────────────────────────────────────┤
│  1. Kiểm tra xung đột giáo viên                             │
│  2. Kiểm tra các ràng buộc                                  │
│  3. Lưu vào database (Schedule collection)                 │
│  4. Trả về kết quả                                           │
└─────────────────────────────────────────────────────────────┘
```

### 3.4. Các ràng buộc xếp lịch

#### 3.4.1. Ràng buộc giáo viên

```javascript
// 1. Không trùng giáo viên
// Một giáo viên không thể dạy 2 lớp cùng lúc
function checkTeacherConflict(teacherId, day, period, year, semester) {
  // Kiểm tra trong database
  const conflict = await Schedule.findOne({
    year, semester,
    'timetable.day': day,
    'timetable.period': period,
    'timetable.teacherId': teacherId,
    classId: { $ne: currentClassId }
  });
  return conflict !== null;
}

// 2. Lịch rảnh
// Giáo viên chỉ có thể dạy trong các slot rảnh
function isTeacherAvailable(teacher, slot) {
  return teacher.availableMatrix[slot.day][slot.period] === true;
}

// 3. Số lớp tối đa
// Giáo viên không vượt quá maxClassPerGrade cho mỗi khối
function canTeacherTakeMoreClasses(teacher, grade) {
  const currentCount = getCurrentClassCount(teacher, grade);
  return currentCount < teacher.maxClassPerGrade[grade];
}

// 4. Số tiết/tuần
// Giáo viên không vượt quá weeklyLessons
function canTeacherTakeMoreLessons(teacher) {
  const currentLessons = getCurrentWeeklyLessons(teacher);
  return currentLessons < teacher.weeklyLessons;
}
```

#### 3.4.2. Ràng buộc thời gian

```javascript
// 1. Buổi chính/phụ
// Môn học chính xếp vào buổi chính, môn phụ xếp vào buổi trái
function isValidSession(item, slot, isMainSessionMorning) {
  if (item.session === 'main') {
    if (isMainSessionMorning) {
      return slot.period <= 5; // Buổi sáng
    } else {
      return slot.period > 5; // Buổi chiều
    }
  } else if (item.session === 'extra') {
    if (isMainSessionMorning) {
      return slot.period > 5; // Buổi chiều (buổi trái)
    } else {
      return slot.period <= 5; // Buổi sáng (buổi trái)
    }
  }
  return true; // Cả ngày
}

// 2. Max tiết/ngày
// Không vượt quá maxPeriodsPerDay cho mỗi môn/ngày
function checkMaxPeriodsPerDay(timetable, item, day) {
  const periodsInDay = countPeriodsForItemInDay(timetable, item, day);
  return periodsInDay < item.maxPeriodsPerDay;
}

// 3. Max tiết/buổi
// Không vượt quá maxPeriodsPerDay cho mỗi môn/buổi
function checkMaxPeriodsPerSession(timetable, item, day, session) {
  const periodsInSession = countPeriodsForItemInSession(
    timetable, item, day, session
  );
  return periodsInSession < item.maxPeriodsPerDay;
}

// 4. Tiết liên tiếp
// Nếu allowConsecutive = false, không xếp 2 tiết liên tiếp
function hasConsecutivePeriod(slot, item, timetable) {
  if (item.allowConsecutive) return false;
  
  const prevPeriod = slot.period - 1;
  const nextPeriod = slot.period + 1;
  
  const prevSlot = timetable[slot.day][prevPeriod];
  const nextSlot = timetable[slot.day][nextPeriod];
  
  return (prevSlot?.item?.id === item.id) || 
         (nextSlot?.item?.id === item.id);
}
```

#### 3.4.3. Ràng buộc phân bổ

```javascript
// 1. Phân bổ đều
// Không thiên vị môn vào các thứ đầu tuần
function calculatePeriodsPerDay(totalPeriods, totalDays) {
  const basePeriods = Math.floor(totalPeriods / totalDays);
  const extraPeriods = totalPeriods % totalDays;
  
  const distribution = Array(totalDays).fill(basePeriods);
  
  // Phân bổ số tiết dư bằng round-robin
  const step = Math.max(1, Math.floor(totalDays / extraPeriods));
  for (let i = 0; i < extraPeriods; i++) {
    const idx = (i * step) % totalDays;
    distribution[idx]++;
  }
  
  return distribution;
}

// 2. Shuffle để tránh thiên vị
// Sử dụng Fisher-Yates shuffle
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

### 3.5. Xử lý buổi chính/phụ

```javascript
// Xác định buổi chính dựa trên gradeSessionRules
const gradeRule = scheduleConfig.gradeSessionRules.find(
  g => g.grade === classGrade
);
const isMainSessionMorning = gradeRule?.session === 'morning';

// Khối học sáng (morning)
if (isMainSessionMorning) {
  // Môn chính → Tiết 1-5 (sáng)
  // Môn phụ → Tiết 6-10 (chiều - buổi trái)
}

// Khối học chiều (afternoon)
else {
  // Môn chính → Tiết 6-10 (chiều)
  // Môn phụ → Tiết 1-5 (sáng - buổi trái)
}

// Khối học cả ngày (both)
// Môn chính → Tiết 1-10 (cả ngày)
// Môn phụ → Tiết 6-10 (chiều)
```

### 3.6. Nguồn dữ liệu số tiết

```javascript
// Ưu tiên 1: ClassPeriods (phân bổ theo lớp)
function getPeriodsForClass(item, classId, year, semester) {
  const classPeriod = classPeriods.find(
    cp => cp.classId === classId && 
         cp.year === year && 
         cp.semester === semester
  );
  
  if (classPeriod) {
    if (item.type === 'subject') {
      return classPeriod.subjectPeriods.get(item.id) || 0;
    } else {
      return classPeriod.activityPeriods.get(item.id) || 0;
    }
  }
  
  // Ưu tiên 2: GradeConfigs (cấu hình mặc định)
  const gradeConfig = scheduleConfig.gradeConfigs.get(classGrade);
  if (gradeConfig) {
    if (item.type === 'subject') {
      return gradeConfig.subjects.get(item.id)?.periodsPerWeek || 0;
    } else {
      return gradeConfig.activities.find(a => a.id === item.id)?.periodsPerWeek || 0;
    }
  }
  
  return 0;
}
```

---

## 4. LUỒNG XỬ LÝ CHI TIẾT

### 4.1. Luồng tổng thể

```
User Request
    ↓
[Phân công giảng dạy tự động]
    ↓
    ├─→ Load dữ liệu
    ├─→ Tính tải hiện tại
    ├─→ Tạo tasks
    ├─→ Xử lý từng task
    └─→ Lưu vào database
    ↓
[TeachingAssignments created]
    ↓
[Xếp thời khóa biểu tự động]
    ↓
    ├─→ Load dữ liệu
    ├─→ Xếp cố định (fixed slots)
    ├─→ Tạo variables
    ├─→ Backtracking solver
    └─→ Lưu vào database
    ↓
[Schedules created]
    ↓
Response
```

### 4.2. Xử lý lỗi và retry

```javascript
// Xếp lịch với retry mechanism
let globalAttempt = 0;
const maxGlobalAttempts = 3;
let allSchedulesGenerated = false;
const schedulesInMemory = [];
const errors = [];

while (!allSchedulesGenerated && globalAttempt < maxGlobalAttempts) {
  globalAttempt++;
  schedulesInMemory = [];
  errors = [];
  
  // Shuffle classes để tránh thiên vị
  const shuffledClasses = shuffleArray(classes);
  
  for (const classObj of shuffledClasses) {
    try {
      const schedule = await generateScheduleForClass(classObj);
      schedulesInMemory.push(schedule);
    } catch (error) {
      errors.push({ className: classObj.className, error });
    }
  }
  
  // Kiểm tra kết quả
  if (schedulesInMemory.length === classes.length) {
    allSchedulesGenerated = true;
  } else if (globalAttempt < maxGlobalAttempts) {
    // Retry
    await sleep(1000);
    continue;
  }
}

// Lưu vào database
for (const schedule of schedulesInMemory) {
  await Schedule.create(schedule);
}
```

---

## 5. CÁC RÀNG BUỘC VÀ ĐIỀU KIỆN

### 5.1. Ràng buộc phân công giảng dạy

| Ràng buộc | Mô tả | Kiểm tra |
|-----------|-------|----------|
| Chuyên môn | Giáo viên phải có môn học này | `teacher.subjects.includes(subjectId)` |
| Phân quyền khối | Giáo viên phải được phân quyền dạy khối này | `teacher.subjects[subjectId].grades.includes(grade)` |
| WeeklyLessons | Không vượt quá số tiết/tuần | `currentWeeklyLessons + periodsPerWeek <= teacher.weeklyLessons` |
| MaxClasses | Không vượt quá tổng số lớp | `currentLoad < teacher.maxClasses` |
| MaxClassPerGrade | Không vượt quá số lớp/khối | `currentGradeCount < teacher.maxClassPerGrade[grade]` |
| Trùng lặp | Không trùng phân công | `!existingAssignmentMap.has(key)` |

### 5.2. Ràng buộc xếp thời khóa biểu

| Ràng buộc | Mô tả | Kiểm tra |
|-----------|-------|----------|
| Trùng giáo viên | Một giáo viên không thể dạy 2 lớp cùng lúc | `!checkTeacherConflict(teacherId, day, period)` |
| Lịch rảnh | Giáo viên chỉ dạy trong slot rảnh | `teacher.availableMatrix[day][period] === true` |
| Buổi chính/phụ | Môn chính xếp vào buổi chính | `isValidSession(item, slot, isMainSessionMorning)` |
| MaxPeriodsPerDay | Không vượt quá số tiết/ngày | `periodsInDay < item.maxPeriodsPerDay` |
| MaxPeriodsPerSession | Không vượt quá số tiết/buổi | `periodsInSession < item.maxPeriodsPerDay` |
| Tiết liên tiếp | Nếu không cho phép, không xếp liên tiếp | `!hasConsecutivePeriod(slot, item)` |
| Fixed slots | Xếp vào vị trí cố định | `fixedSlots.includes(slot)` |

---

## 6. THUẬT TOÁN VÀ HEURISTIC

### 6.1. CSP (Constraint Satisfaction Problem)

**Mô hình:**
- **Variables:** Mỗi môn học/hoạt động cần xếp
- **Values:** Các slot thời gian (ngày + tiết)
- **Constraints:** Các ràng buộc phải tuân thủ

**Mục tiêu:** Tìm assignment cho tất cả variables sao cho thỏa mãn tất cả constraints.

### 6.2. Backtracking Algorithm

**Ý tưởng:**
1. Thử xếp từng môn vào các slot có thể
2. Nếu vi phạm ràng buộc → backtrack và thử slot khác
3. Tiếp tục cho đến khi tìm thấy giải pháp hoặc không có giải pháp

**Pseudo-code:**
```javascript
function backtrack(variables, timetable) {
  if (allVariablesPlaced(variables)) {
    return timetable; // Giải pháp tìm thấy
  }
  
  variable = selectNextVariable(variables); // MRV
  slots = getAvailableSlots(timetable);
  scoredSlots = scoreSlots(slots, variable); // LCV
  scoredSlots.sort((a, b) => a.score - b.score);
  
  for (scoredSlot of scoredSlots) {
    if (isValidAssignment(scoredSlot.slot, variable)) {
      // Thử xếp
      placeAssignment(scoredSlot.slot, variable);
      
      // Recursive
      result = backtrack(variables, timetable);
      if (result !== null) {
        return result;
      }
      
      // Backtrack
      removeAssignment(scoredSlot.slot, variable);
    }
  }
  
  return null; // Không tìm thấy giải pháp
}
```

### 6.3. Heuristic Functions

#### 6.3.1. MRV (Minimum Remaining Values)

**Mục đích:** Chọn biến (môn học) có ít giá trị còn lại nhất.

**Logic:**
```javascript
function selectNextVariable(variables) {
  return variables
    .filter(v => v.periodsRemaining > 0)
    .sort((a, b) => {
      // Ưu tiên môn học trước hoạt động
      if (a.item.type === 'subject' && b.item.type === 'activity') return -1;
      if (a.item.type === 'activity' && b.item.type === 'subject') return 1;
      
      // Ưu tiên môn còn nhiều tiết hơn
      return b.periodsRemaining - a.periodsRemaining;
    })[0];
}
```

#### 6.3.2. LCV (Least Constraining Value)

**Mục đích:** Chọn slot có ít ràng buộc nhất.

**Logic:**
```javascript
function calculateLCVScore(slot, item, teacher, timetable) {
  let score = 0;
  
  // Ràng buộc giáo viên (nếu có)
  if (teacher.id) {
    if (!isTeacherAvailable(teacher, slot)) score += 1000;
    if (!canTeacherTakeMoreLessons(teacher)) score += 500;
  } else {
    const conflictCount = countSubjectConflict(slot, item, timetable);
    score += conflictCount * 50;
  }
  
  // Ràng buộc thời gian
  if (!item.allowConsecutive && hasConsecutivePeriod(slot, item)) {
    score += 200;
  }
  if (item.allowConsecutive && isConsecutiveSlot(slot, item)) {
    score -= 50; // Bonus
  }
  
  // Phân bổ đều
  const periodsInDay = countPeriodsInDay(timetable, slot.day);
  score += periodsInDay * 10;
  
  // Không thiên vị
  score += dayIndex * 0.1;
  
  return score;
}
```

---

## 7. VÍ DỤ MINH HỌA

### 7.1. Ví dụ 1: Phân công giảng dạy

**Tình huống:**
- Lớp: 10A1, 10A2, 10A3
- Môn: Toán (4 tiết/tuần)
- Giáo viên:
  - GV1: Toán, maxClasses = 3, weeklyLessons = 19, đang dạy 1 lớp (8 tiết)
  - GV2: Toán, maxClasses = 3, weeklyLessons = 19, đang dạy 2 lớp (12 tiết)
  - GV3: Toán, maxClasses = 2, weeklyLessons = 19, đang dạy 1 lớp (8 tiết)

**Xử lý:**

```
Task 1: 10A1 - Toán
  Candidate: GV1, GV2, GV3
  Lọc:
    - GV1: 1 + 1 = 2 <= 3 ✅, 8 + 4 = 12 <= 19 ✅
    - GV2: 2 + 1 = 3 <= 3 ✅, 12 + 4 = 16 <= 19 ✅
    - GV3: 1 + 1 = 2 <= 2 ✅, 8 + 4 = 12 <= 19 ✅
  Chọn: GV1 (ít lớp nhất: 1 < 2)
  Kết quả: GV1 dạy 10A1

Task 2: 10A2 - Toán
  Candidate: GV1, GV2, GV3
  Lọc:
    - GV1: 2 + 1 = 3 <= 3 ✅, 12 + 4 = 16 <= 19 ✅
    - GV2: 2 + 1 = 3 <= 3 ✅, 12 + 4 = 16 <= 19 ✅
    - GV3: 1 + 1 = 2 <= 2 ✅, 8 + 4 = 12 <= 19 ✅
  Chọn: GV3 (ít lớp nhất: 1 < 2)
  Kết quả: GV3 dạy 10A2

Task 3: 10A3 - Toán
  Candidate: GV1, GV2
  Lọc:
    - GV1: 2 + 1 = 3 <= 3 ✅, 16 + 4 = 20 > 19 ❌
    - GV2: 2 + 1 = 3 <= 3 ✅, 12 + 4 = 16 <= 19 ✅
  Chọn: GV2
  Kết quả: GV2 dạy 10A3
```

### 7.2. Ví dụ 2: Xếp thời khóa biểu

**Tình huống:**
- Lớp: 10A1
- Môn: Toán (4 tiết/tuần), GV1
- Cấu hình: 5 ngày/tuần, 5 tiết sáng, 5 tiết chiều
- Buổi chính: Sáng

**Xử lý:**

```
Bước 1: Tạo variables
  variables = [
    { item: Toán, teacher: GV1, periodsRemaining: 4, ... }
  ]

Bước 2: Backtracking
  Iteration 1:
    Variable: Toán (4 tiết còn lại)
    Available slots: Tất cả slot sáng (vì buổi chính)
    Scored slots:
      - Monday tiết 1: score = 10 (ngày có 0 môn)
      - Monday tiết 2: score = 10
      - Tuesday tiết 1: score = 10
      - ...
    Chọn: Monday tiết 1 (score thấp nhất)
    Kiểm tra: ✅ GV1 rảnh, không conflict
    Xếp: Monday tiết 1 = Toán (GV1)
    periodsRemaining = 3

  Iteration 2:
    Variable: Toán (3 tiết còn lại)
    Available slots: Các slot sáng còn lại
    Scored slots:
      - Monday tiết 2: score = 20 (ngày có 1 môn)
      - Tuesday tiết 1: score = 10 (ngày có 0 môn)
      - ...
    Chọn: Tuesday tiết 1 (score thấp nhất)
    Kiểm tra: ✅ GV1 rảnh, không conflict
    Xếp: Tuesday tiết 1 = Toán (GV1)
    periodsRemaining = 2

  Iteration 3:
    Variable: Toán (2 tiết còn lại)
    Available slots: Các slot sáng còn lại
    Scored slots:
      - Wednesday tiết 1: score = 10 (ngày có 0 môn)
      - ...
    Chọn: Wednesday tiết 1
    Xếp: Wednesday tiết 1 = Toán (GV1)
    periodsRemaining = 1

  Iteration 4:
    Variable: Toán (1 tiết còn lại)
    Available slots: Các slot sáng còn lại
    Scored slots:
      - Thursday tiết 1: score = 10 (ngày có 0 môn)
      - ...
    Chọn: Thursday tiết 1
    Xếp: Thursday tiết 1 = Toán (GV1)
    periodsRemaining = 0

Bước 3: Kết quả
  Timetable:
    Monday:    [Toán, ...]
    Tuesday:   [Toán, ...]
    Wednesday: [Toán, ...]
    Thursday:  [Toán, ...]
    Friday:    [...]
```

---

## 📊 TỔNG KẾT

### Điểm mạnh

1. ✅ **Thuật toán CSP + Backtracking** - Đảm bảo tìm được giải pháp tối ưu
2. ✅ **Heuristic MRV + LCV** - Tăng tốc độ tìm giải pháp
3. ✅ **Xử lý đầy đủ ràng buộc** - Đảm bảo tính hợp lệ
4. ✅ **Phân bổ đều** - Tránh thiên vị
5. ✅ **Retry mechanism** - Xử lý lỗi tốt
6. ✅ **Cân bằng tải giáo viên** - Phân công công bằng

### Hạn chế

1. ⚠️ **Thời gian xử lý** - Có thể mất vài phút với nhiều lớp
2. ⚠️ **Không đảm bảo tối ưu toàn cục** - Chỉ tối ưu local
3. ⚠️ **Phụ thuộc vào dữ liệu đầu vào** - Cần dữ liệu đầy đủ và chính xác

### Khuyến nghị

1. ✅ **Cải thiện performance** - Tối ưu thuật toán, cache kết quả
2. ✅ **Thêm validation** - Kiểm tra dữ liệu đầu vào kỹ hơn
3. ✅ **Thêm monitoring** - Theo dõi thời gian xử lý và kết quả
4. ✅ **Thêm undo/redo** - Cho phép hoàn tác và làm lại

---

**Kết luận:** Hệ thống tự động phân công giảng dạy và xếp thời khóa biểu được thiết kế tốt với thuật toán CSP + Backtracking và các heuristic phù hợp. Hệ thống đảm bảo tính hợp lệ và phân bổ công bằng, phù hợp cho môi trường THPT.

---

**Người phân tích:** AI Assistant  
**Ngày:** $(date)


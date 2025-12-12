# 🧮 Thuật Toán Backtracking Tạo Thời Khóa Biểu Tự Động

## 📋 Mục Lục

1. [Tổng Quan](#tổng-quan)
2. [Mô Hình CSP (Constraint Satisfaction Problem)](#mô-hình-csp)
3. [Thuật Toán Backtracking](#thuật-toán-backtracking)
4. [Các Ràng Buộc (Constraints)](#các-ràng-buộc-constraints)
5. [Heuristic Functions](#heuristic-functions)
6. [Quy Trình Thực Hiện](#quy-trình-thực-hiện)
7. [Ví Dụ Cụ Thể](#ví-dụ-cụ-thể)
8. [Tối Ưu Hóa](#tối-ưu-hóa)

---

## 🎯 Tổng Quan

Hệ thống sử dụng thuật toán **Backtracking** kết hợp với **CSP (Constraint Satisfaction Problem)** để tự động tạo thời khóa biểu cho các lớp học. Thuật toán này đảm bảo:

- ✅ Không trùng giáo viên (một giáo viên không thể dạy 2 lớp cùng lúc)
- ✅ Không trùng phòng học (nếu lớp có phòng cố định)
- ✅ Tuân thủ lịch rảnh của giáo viên (`availableMatrix`)
- ✅ Đảm bảo số tiết/tuần cho mỗi môn học
- ✅ Tôn trọng các hoạt động cố định (Chào cờ, Sinh hoạt, v.v.)
- ✅ Phân bổ hợp lý theo buổi sáng/chiều

---

## 🔧 Mô Hình CSP

### 1. **Variables (Biến)**

Mỗi **variable** đại diện cho một "nhiệm vụ" cần xếp vào thời khóa biểu:

```javascript
{
  id: "subjectId-single-0-classId",        // ID duy nhất
  subjectId: ObjectId,                      // Môn học
  subjectName: "Toán",                      // Tên môn
  teacherId: ObjectId,                       // Giáo viên
  teacherName: "Nguyễn Văn A",              // Tên giáo viên
  teacher: TeacherObject,                   // Object giáo viên (có availableMatrix)
  maxPerDay: 2,                             // Số tiết tối đa/ngày
  session: "main" | "extra",                // Buổi sáng hoặc chiều
  length: 1 | 2                             // Độ dài: 1 tiết hoặc 2 tiết liền kề
}
```

**Ví dụ:**
- Môn Toán cần 4 tiết/tuần → Tạo 2 variables: 1 pair (2 tiết) + 2 single (1 tiết)
- Môn Văn cần 3 tiết/tuần → Tạo 1 pair (2 tiết) + 1 single (1 tiết)

### 2. **Domain (Miền Giá Trị)**

Mỗi variable có một **domain** - danh sách các vị trí (slot) có thể xếp:

```javascript
[
  { dayIdx: 0, day: "Monday", positions: [0, 1] },      // Thứ 2, tiết 1-2 (pair)
  { dayIdx: 1, day: "Tuesday", positions: [2] },        // Thứ 3, tiết 3 (single)
  { dayIdx: 2, day: "Wednesday", positions: [0, 1] },     // Thứ 4, tiết 1-2 (pair)
  // ...
]
```

**Domain được xây dựng dựa trên:**
- Slot còn trống (chưa có môn/hoạt động)
- Slot không bị khóa (locked = false)
- Giáo viên rảnh (`availableMatrix[dayIdx][periodIdx] === true`)
- Không trùng với giáo viên khác (kiểm tra `teacherSlotMap`)
- Không trùng với phòng học (nếu có `roomSlotMap`)
- Không vượt quá `maxPerDay` cho môn học đó trong ngày

### 3. **Constraints (Ràng Buộc)**

Các quy tắc phải tuân thủ khi xếp lịch:

#### 3.1. **Hard Constraints (Ràng Buộc Cứng - Bắt Buộc)**

1. **Không trùng giáo viên:**
   ```
   ∀ teacher, day, period: chỉ có 1 lớp được xếp
   ```

2. **Không trùng phòng học:**
   ```
   ∀ room, day, period: chỉ có 1 lớp được xếp (nếu lớp có phòng cố định)
   ```

3. **Giáo viên phải rảnh:**
   ```
   availableMatrix[day][period] === true
   ```

4. **Slot không bị khóa:**
   ```
   slot.locked === false
   ```

5. **Slot còn trống:**
   ```
   slot.subject === ""
   ```

6. **Không vượt quá maxPerDay:**
   ```
   Số tiết môn X trong ngày ≤ maxPerDay
   ```

#### 3.2. **Soft Constraints (Ràng Buộc Mềm - Ưu Tiên)**

1. **Phân bổ đều trong tuần:** Tránh xếp quá nhiều tiết cùng một ngày
2. **Ưu tiên tiết liền kề:** Một số môn nên có 2 tiết liền kề (pair)
3. **Phân bổ theo buổi:** Môn chính ở buổi sáng, môn phụ ở buổi chiều

---

## 🔄 Thuật Toán Backtracking

### 1. **Cấu Trúc Cơ Bản**

```javascript
function backtrack(pendingVars, timetable) {
  // Base case: Tất cả variables đã được xếp
  if (pendingVars.length === 0) {
    return true; // ✅ Tìm thấy giải pháp
  }

  // Chọn variable tiếp theo (MRV heuristic)
  const bestVar = selectVariableWithMRV(pendingVars, timetable);
  
  // Xây dựng domain cho variable này
  const domain = buildDomainForVariable(bestVar, timetable);
  
  // Nếu không có domain → không có giải pháp
  if (domain.length === 0) {
    return false; // ❌ Dead end
  }

  // Thử từng giá trị trong domain
  for (const position of domain) {
    // Gán variable vào position
    assignToSlot(bestVar, position, timetable);
    
    // Forward checking: Kiểm tra các variables còn lại có domain không
    if (forwardCheck(remainingVars, timetable)) {
      // Đệ quy: Thử xếp các variables còn lại
      if (backtrack(remainingVars, timetable)) {
        return true; // ✅ Tìm thấy giải pháp
      }
    }
    
    // Backtrack: Gỡ bỏ assignment và thử giá trị khác
    removeAssignment(bestVar, position, timetable);
  }

  return false; // ❌ Không tìm thấy giải pháp
}
```

### 2. **Quy Trình Chi Tiết**

#### **Bước 1: Khởi Tạo**

```javascript
// 1. Tạo timetable rỗng
const timetable = createEmptyTimetable(days, totalPeriods, restPeriods);

// 2. Xếp các hoạt động cố định trước (Chào cờ, Sinh hoạt, v.v.)
placeActivitiesOnTimetable(timetable, activities);

// 3. Tạo variables từ phân công giảng dạy
const variables = buildVariablesForClass(assignments, classObj, config);

// 4. Khởi tạo tracking maps
const teacherSlotMap = new Map();  // Track giáo viên đã xếp
const roomSlotMap = new Map();     // Track phòng học đã xếp
const perDaySubjectCount = new Map(); // Track số tiết mỗi môn/ngày
```

**📌 Lưu ý quan trọng:** 
- `assignments` ở đây là danh sách `TeachingAssignment` đã được lấy từ database
- Mỗi assignment chứa thông tin: `teacherId`, `subjectId`, `classId`
- Nếu lớp chưa có phân công giảng dạy, thuật toán sẽ bỏ qua lớp đó

#### **Bước 2: Chọn Variable (MRV)**

```javascript
function selectVariableWithMRV(pendingVars, timetable) {
  let bestVar = null;
  let bestDomain = null;
  let minDomainSize = Infinity;

  for (const variable of pendingVars) {
    // Xây dựng domain cho variable này
    const domain = buildDomainForVariable(variable, timetable);
    
    // MRV: Chọn variable có domain nhỏ nhất
    if (domain.length < minDomainSize) {
      minDomainSize = domain.length;
      bestVar = variable;
      bestDomain = domain;
      
      // Nếu domain = 1 → chắc chắn phải xếp ở đây → dừng ngay
      if (domain.length === 1) break;
    }
  }

  return { variable: bestVar, domain: bestDomain };
}
```

**Lý do sử dụng MRV:**
- Variable có domain nhỏ → ít lựa chọn → nên xếp trước
- Giảm số lượng backtracking không cần thiết
- Fail-fast: Phát hiện sớm nếu không có giải pháp

#### **Bước 3: Xây Dựng Domain**

```javascript
function buildDomainForVariable(variable, timetable) {
  const domain = [];
  const { subjectName, teacherId, teacher, session, maxPerDay, length } = variable;
  
  // Xác định phạm vi tiết (sáng hoặc chiều)
  const targetStart = session === "extra" ? extraStart : mainStart;
  const targetEnd = session === "extra" ? extraEnd : mainEnd;
  
  // Duyệt qua từng ngày
  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const dayEntry = timetable[dayIdx];
    const subjectCountMap = perDaySubjectCount.get(dayEntry.day);
    const currentCount = subjectCountMap.get(subjectName) || 0;
    
    // Kiểm tra maxPerDay
    if (currentCount + length > maxPerDay) continue;
    
    // Duyệt qua từng tiết trong phạm vi
    for (let periodIdx = targetStart; periodIdx <= targetEnd - length; periodIdx++) {
      // Kiểm tra slot có trống không
      const slot = dayEntry.periods[periodIdx];
      if (!slot || slot.subject || slot.locked) continue;
      
      // Kiểm tra giáo viên có rảnh không
      if (!getTeacherAvailability(teacher, dayIdx, periodIdx)) continue;
      
      // Kiểm tra các tiết liền kề (nếu là pair)
      let conflictFound = false;
      const positions = [];
      
      for (let offset = 0; offset < length; offset++) {
        const checkingIdx = periodIdx + offset;
        const checkingSlot = dayEntry.periods[checkingIdx];
        
        // Kiểm tra slot trống và không bị khóa
        if (!checkingSlot || checkingSlot.subject || checkingSlot.locked) {
          conflictFound = true;
          break;
        }
        
        // Kiểm tra giáo viên rảnh
        if (!getTeacherAvailability(teacher, dayIdx, checkingIdx)) {
          conflictFound = true;
          break;
        }
        
        // Kiểm tra trùng giáo viên
        if (teacherId) {
          const key = makeSlotKey(teacherId, dayEntry.day, checkingSlot.period);
          if (teacherSlotMap.has(key)) {
            conflictFound = true;
            break;
          }
        }
        
        // Kiểm tra trùng phòng học
        if (classRoomId) {
          const roomKey = makeSlotKey(classRoomId, dayEntry.day, checkingSlot.period);
          if (roomSlotMap.has(roomKey)) {
            conflictFound = true;
            break;
          }
        }
        
        positions.push(checkingIdx);
      }
      
      if (!conflictFound) {
        domain.push({
          dayIdx,
          day: dayEntry.day,
          positions
        });
      }
    }
  }
  
  return domain;
}
```

#### **Bước 4: Forward Checking**

```javascript
function forwardCheck(remainingVars, domainCache) {
  for (const variable of remainingVars) {
    // Lấy domain từ cache (đã tính trước)
    const cached = domainCache.get(variable.id);
    
    // Nếu chưa có trong cache → tính lại
    if (!cached) {
      const domain = buildDomainForVariable(variable, timetable);
      domainCache.set(variable.id, domain);
      
      // Nếu domain rỗng → không có giải pháp
      if (domain.length === 0) {
        return false;
      }
    } else {
      // Nếu domain rỗng → không có giải pháp
      if (cached.length === 0) {
        return false;
      }
    }
  }
  
  return true; // Tất cả variables còn lại đều có domain
}
```

**Lợi ích:**
- Phát hiện sớm nếu assignment hiện tại dẫn đến dead end
- Giảm số lượng backtracking không cần thiết
- Tăng tốc độ tìm kiếm

#### **Bước 5: Assign và Remove**

```javascript
function assignToSlot(variable, position, timetable) {
  const positions = position.positions;
  const dayEntry = timetable[position.dayIdx];
  const subjectCountMap = perDaySubjectCount.get(dayEntry.day);
  const teacherKeys = [];
  const roomKeys = [];

  // Gán vào từng slot
  positions.forEach((periodIdx) => {
    const slot = dayEntry.periods[periodIdx];
    slot.subject = variable.subjectName;
    slot.subjectId = variable.subjectId;
    slot.teacher = variable.teacherName;
    slot.teacherId = variable.teacherId;

    // Track giáo viên
    if (variable.teacherId) {
      const teacherKey = makeSlotKey(variable.teacherId, dayEntry.day, slot.period);
      teacherSlotMap.set(teacherKey, {
        className: classObj.className,
        classId: classObj._id,
      });
      teacherKeys.push(teacherKey);
    }

    // Track phòng học
    if (classRoomId) {
      const roomKey = makeSlotKey(classRoomId, dayEntry.day, slot.period);
      roomSlotMap.set(roomKey, {
        className: classObj.className,
        classId: classObj._id,
      });
      roomKeys.push(roomKey);
    }
  });

  // Cập nhật số tiết môn học trong ngày
  subjectCountMap.set(
    variable.subjectName,
    (subjectCountMap.get(variable.subjectName) || 0) + positions.length
  );

  return { teacherKeys, roomKeys };
}

function removeAssignment(variable, position, keys, timetable) {
  const positions = position.positions;
  const dayEntry = timetable[position.dayIdx];

  // Gỡ bỏ assignment
  positions.forEach((periodIdx) => {
    const slot = dayEntry.periods[periodIdx];
    slot.subject = "";
    slot.subjectId = null;
    slot.teacher = "";
    slot.teacherId = null;
  });

  // Cập nhật số tiết môn học trong ngày
  const subjectCountMap = perDaySubjectCount.get(dayEntry.day);
  subjectCountMap.set(
    variable.subjectName,
    Math.max((subjectCountMap.get(variable.subjectName) || positions.length) - positions.length, 0)
  );

  // Xóa tracking
  (keys.teacherKeys || []).forEach((key) => teacherSlotMap.delete(key));
  (keys.roomKeys || []).forEach((key) => roomSlotMap.delete(key));
}
```

---

## 📐 Các Ràng Buộc (Constraints)

### 1. **Ràng Buộc Giáo Viên**

#### 1.1. Không Trùng Giáo Viên

```javascript
// Một giáo viên không thể dạy 2 lớp cùng lúc
const conflictKey = `${teacherId}_${day}_${period}_${year}_${semester}`;

if (teacherSlotMap.has(conflictKey)) {
  // ❌ Conflict: Giáo viên đã dạy lớp khác ở slot này
  return false;
}
```

#### 1.2. Lịch Rảnh (Available Matrix)

```javascript
function getTeacherAvailability(teacher, dayIdx, periodIdx) {
  if (!teacher || !teacher.availableMatrix) return true;
  
  const matrix = teacher.availableMatrix;
  if (!Array.isArray(matrix)) return true;
  if (dayIdx < 0 || dayIdx >= matrix.length) return true;
  
  const dayRow = matrix[dayIdx];
  if (!Array.isArray(dayRow)) return true;
  if (periodIdx < 0 || periodIdx >= dayRow.length) return true;
  
  const value = dayRow[periodIdx];
  // true = rảnh, false = không rảnh, undefined/null = rảnh (mặc định)
  return value === true || value === undefined || value === null;
}
```

**Cấu trúc `availableMatrix`:**
```javascript
availableMatrix = [
  [true, true, false, true, true],   // Thứ 2: tiết 1-5
  [true, true, true, true, true],    // Thứ 3: tiết 1-5
  [false, false, true, true, true],  // Thứ 4: tiết 1-5
  // ...
]
```

### 2. **Ràng Buộc Phòng Học**

```javascript
// Nếu lớp có phòng cố định, không được trùng với lớp khác
if (classRoomId) {
  const roomKey = makeSlotKey(classRoomId, day, period);
  if (roomSlotMap.has(roomKey)) {
    // ❌ Conflict: Phòng đã được sử dụng bởi lớp khác
    return false;
  }
}
```

### 3. **Ràng Buộc Môn Học**

#### 3.1. Số Tiết Tối Đa Mỗi Ngày (maxPerDay)

```javascript
const subjectCountMap = perDaySubjectCount.get(day);
const currentCount = subjectCountMap.get(subjectName) || 0;

if (currentCount + variable.length > maxPerDay) {
  // ❌ Vượt quá số tiết tối đa/ngày
  return false;
}
```

**Ví dụ:**
- Môn Toán: `maxPerDay = 2` → Tối đa 2 tiết/ngày
- Môn Văn: `maxPerDay = 2` → Tối đa 2 tiết/ngày

#### 3.2. Số Tiết Mỗi Tuần (periodsPerWeek)

```javascript
// Được xác định từ:
// 1. ClassPeriods (ưu tiên nhất)
// 2. GradeConfig.classPeriods (theo lớp)
// 3. GradeConfig.periodsPerWeek (mặc định)
const periodsPerWeek = getSubjectPeriodsPerWeek({
  subjectId,
  grade,
  classId,
  classPeriodsRecord,
  gradeConfig
});
```

### 4. **Ràng Buộc Hoạt Động Cố Định**

```javascript
// Các hoạt động cố định được xếp trước và khóa lại
placeActivitiesOnTimetable(timetable, activities);

// Slot bị khóa không thể xếp môn học khác
if (slot.locked === true) {
  return false; // ❌ Slot đã bị khóa
}
```

**Ví dụ hoạt động cố định:**
- Chào cờ: Thứ 2, tiết 1
- Sinh hoạt: Thứ 7, tiết 5
- Thể dục toàn trường: Thứ 3, tiết 3

### 5. **Ràng Buộc Buổi Sáng/Chiều**

```javascript
// Môn chính ở buổi sáng (main session)
const mainStart = mainSession === "morning" ? 0 : morningCount;
const mainEnd = mainSession === "morning" ? morningCount : total;

// Môn phụ ở buổi chiều (extra session)
const extraStart = mainSession === "morning" ? morningCount : 0;
const extraEnd = mainSession === "morning" ? total : morningCount;
```

---

## 🎯 Heuristic Functions

### 1. **MRV (Minimum Remaining Values)**

**Mục đích:** Chọn variable có ít lựa chọn nhất để xếp trước.

```javascript
function selectVariableWithMRV(pendingVars, timetable) {
  let bestVar = null;
  let minDomainSize = Infinity;

  for (const variable of pendingVars) {
    const domain = buildDomainForVariable(variable, timetable);
    
    // MRV: Chọn variable có domain nhỏ nhất
    if (domain.length < minDomainSize) {
      minDomainSize = domain.length;
      bestVar = variable;
      
      // Nếu domain = 1 → chắc chắn phải xếp ở đây
      if (domain.length === 1) break;
    }
  }

  return bestVar;
}
```

**Lý do:**
- Variable có domain nhỏ → ít lựa chọn → nên xếp trước
- Giảm số lượng backtracking
- Fail-fast: Phát hiện sớm nếu không có giải pháp

### 2. **Forward Checking**

**Mục đích:** Kiểm tra xem assignment hiện tại có làm cho các variables còn lại mất domain không.

```javascript
function forwardCheck(remainingVars, domainCache) {
  for (const variable of remainingVars) {
    const domain = domainCache.get(variable.id) || 
                   buildDomainForVariable(variable, timetable);
    
    if (domain.length === 0) {
      return false; // ❌ Variable này không còn lựa chọn
    }
  }
  
  return true; // ✅ Tất cả variables còn lại đều có lựa chọn
}
```

**Lợi ích:**
- Phát hiện sớm dead end
- Giảm backtracking không cần thiết
- Tăng tốc độ tìm kiếm

### 3. **Domain Shuffling (Randomization)**

**Mục đích:** Tránh bias, tạo đa dạng trong giải pháp.

```javascript
// Shuffle domain để thử các giá trị ngẫu nhiên
const shuffledDomain = [...domain].sort(() => Math.random() - 0.5);

for (const position of shuffledDomain) {
  // Thử xếp vào position này
}
```

---

## 🔄 Quy Trình Thực Hiện

### **Tổng Quan**

```
1. Khởi tạo
   ├─ Tạo timetable rỗng
   ├─ Xếp hoạt động cố định
   ├─ Tạo variables từ phân công
   └─ Khởi tạo tracking maps

2. Backtracking Loop
   ├─ Chọn variable (MRV)
   ├─ Xây dựng domain
   ├─ Thử từng giá trị
   │  ├─ Assign
   │  ├─ Forward check
   │  ├─ Đệ quy
   │  └─ Remove (nếu fail)
   └─ Lặp lại cho đến khi thành công hoặc hết lựa chọn

3. Kết quả
   ├─ Success: Trả về timetable
   └─ Failure: Trả về null
```

### **Chi Tiết Từng Bước**

#### **Bước 0: Lấy Phân Công Giảng Dạy (TeachingAssignment)**

**Mục đích:** Thuật toán Backtracking **BẮT BUỘC** phải có phân công giảng dạy để biết giáo viên nào dạy môn nào cho lớp nào.

```javascript
// 1. Lấy tất cả phân công giảng dạy từ database
const assignments = await TeachingAssignment.find({ 
  year, 
  semester 
})
  .populate("teacherId", "name availableMatrix")  // Lấy thông tin giáo viên + lịch rảnh
  .populate("subjectId", "name")                  // Lấy tên môn học
  .populate("classId", "className classCode grade roomId")  // Lấy thông tin lớp
  .lean();

// 2. Tạo map theo lớp để dễ truy cập
const classAssignmentsMap = new Map();
assignments.forEach((assignment) => {
  if (!assignment.classId) return;
  const clsId = assignment.classId._id.toString();
  
  if (!classAssignmentsMap.has(clsId)) {
    classAssignmentsMap.set(clsId, []);
  }
  classAssignmentsMap.get(clsId).push(assignment);
});

// 3. Kiểm tra lớp có phân công hay chưa
for (const classObj of classes) {
  const classAssignments = classAssignmentsMap.get(classObj._id.toString()) || [];
  
  if (classAssignments.length === 0) {
    // ❌ Lớp chưa có phân công giảng dạy → Bỏ qua lớp này
    errors.push({
      className: classObj.className,
      error: "Lớp chưa có phân công giảng dạy.",
    });
    continue;
  }
  
  // ✅ Lớp có phân công → Tiếp tục tạo TKB
  // ...
}
```

**Cấu trúc TeachingAssignment:**
```javascript
{
  _id: ObjectId,
  year: "2025-2026",
  semester: "1",
  teacherId: ObjectId,      // Giáo viên được phân công
  subjectId: ObjectId,      // Môn học được phân công
  classId: ObjectId,        // Lớp được phân công
  // ... các trường khác
}
```

**Lưu ý quan trọng:**
- ⚠️ **Nếu lớp chưa có phân công giảng dạy, thuật toán sẽ KHÔNG thể tạo TKB cho lớp đó**
- ✅ Phân công giảng dạy phải được tạo trước khi chạy Backtracking
- ✅ Có thể tạo phân công thủ công hoặc dùng chức năng "Phân công tự động"

#### **Bước 1: Khởi Tạo Timetable**

```javascript
// Tạo timetable rỗng
const timetable = createEmptyTimetable(days, totalPeriods, restPeriods);

// Kết quả:
[
  {
    day: "Monday",
    periods: [
      { period: 1, subject: "", teacher: "", locked: false },
      { period: 2, subject: "", teacher: "", locked: false },
      // ...
    ]
  },
  // ...
]
```

#### **Bước 2: Xếp Hoạt Động Cố Định**

```javascript
placeActivitiesOnTimetable(timetable, activities);

// Kết quả:
[
  {
    day: "Monday",
    periods: [
      { period: 1, subject: "Chào cờ", teacher: "", locked: true },  // ✅ Đã khóa
      { period: 2, subject: "", teacher: "", locked: false },
      // ...
    ]
  },
  // ...
]
```

#### **Bước 3: Tạo Variables Từ Phân Công Giảng Dạy**

**Mục đích:** Chuyển đổi phân công giảng dạy (`TeachingAssignment`) thành các variables để backtracking có thể xử lý.

```javascript
function buildVariablesForClass({
  classAssignments,  // ✅ Danh sách TeachingAssignment của lớp (từ Bước 0)
  classObj,
  classPeriodsRecord,
  gradeConfig,
  subjectMap,
  allowPairs = true,
}) {
  const variables = [];

  // ✅ Duyệt qua từng phân công giảng dạy
  classAssignments.forEach((assignment) => {
    if (!assignment.subjectId || !assignment.teacherId) return;
    
    const subjectIdStr = assignment.subjectId._id.toString();
    const subjectData = subjectMap.get(subjectIdStr);
    const subjectName = subjectData?.name || assignment.subjectId.name || "Môn học";

    // Tính số tiết/tuần cho môn học này
    const periodsPerWeek = getSubjectPeriodsPerWeek({
      subjectId: subjectIdStr,
      grade: classObj.grade,
      classId: classObj._id,
      classPeriodsRecord,
      gradeConfig,
    });

    if (periodsPerWeek <= 0) return;

    const subjectConfig = getSubjectConfig(gradeConfig, subjectIdStr) || {};
    const maxPerDay = subjectConfig.maxPerDay || 2;
    const session = subjectConfig.session === "extra" ? "extra" : "main";
    const canPair = allowPairs && subjectConfig.allowConsecutive !== false;

    let remainingPeriods = periodsPerWeek;

    // ✅ Tạo variables cho các cặp tiết (2 tiết liền kề)
    if (canPair && remainingPeriods >= 2) {
      const pairCount = Math.floor(remainingPeriods / 2);
      for (let i = 0; i < pairCount; i++) {
        variables.push({
          id: `${subjectIdStr}-pair-${i}-${classObj._id}`,
          subjectId: assignment.subjectId._id,      // ✅ Từ assignment
          subjectName,
          teacherId: assignment.teacherId._id,       // ✅ Từ assignment
          teacherName: assignment.teacherId.name || "Chưa rõ",  // ✅ Từ assignment
          teacher: assignment.teacherId,            // ✅ Object giáo viên (có availableMatrix)
          maxPerDay,
          session,
          length: 2,  // 2 tiết liền kề
        });
      }
      remainingPeriods -= pairCount * 2;
    }

    // ✅ Tạo variables cho các tiết đơn (1 tiết)
    for (let i = 0; i < remainingPeriods; i++) {
      variables.push({
        id: `${subjectIdStr}-single-${i}-${classObj._id}`,
        subjectId: assignment.subjectId._id,      // ✅ Từ assignment
        subjectName,
        teacherId: assignment.teacherId._id,      // ✅ Từ assignment
        teacherName: assignment.teacherId.name || "Chưa rõ",  // ✅ Từ assignment
        teacher: assignment.teacherId,             // ✅ Object giáo viên (có availableMatrix)
        maxPerDay,
        session,
        length: 1,  // 1 tiết
      });
    }
  });

  return variables;
}
```

**Ví dụ cụ thể:**

Giả sử lớp 10A1 có phân công giảng dạy:
- Toán: 4 tiết/tuần, GV Nguyễn Văn A
- Văn: 3 tiết/tuần, GV Trần Thị B
- Anh: 3 tiết/tuần, GV Lê Văn C

Sau khi chạy `buildVariablesForClass`, sẽ tạo ra:
```javascript
[
  // Toán: 4 tiết = 1 pair (2 tiết) + 2 single (1 tiết)
  { id: "toan-pair-0-10A1", subjectName: "Toán", teacherName: "Nguyễn Văn A", length: 2 },
  { id: "toan-single-0-10A1", subjectName: "Toán", teacherName: "Nguyễn Văn A", length: 1 },
  { id: "toan-single-1-10A1", subjectName: "Toán", teacherName: "Nguyễn Văn A", length: 1 },
  
  // Văn: 3 tiết = 1 pair (2 tiết) + 1 single (1 tiết)
  { id: "van-pair-0-10A1", subjectName: "Văn", teacherName: "Trần Thị B", length: 2 },
  { id: "van-single-0-10A1", subjectName: "Văn", teacherName: "Trần Thị B", length: 1 },
  
  // Anh: 3 tiết = 1 pair (2 tiết) + 1 single (1 tiết)
  { id: "anh-pair-0-10A1", subjectName: "Anh", teacherName: "Lê Văn C", length: 2 },
  { id: "anh-single-0-10A1", subjectName: "Anh", teacherName: "Lê Văn C", length: 1 },
]
```

**Tổng cộng:** 7 variables cần xếp vào TKB.

#### **Bước 4: Backtracking**

```javascript
// Iteration 1: Chọn variable đầu tiên (MRV)
variable = variables[0]; // "toan-pair-0"
domain = [
  { dayIdx: 0, day: "Monday", positions: [1, 2] },    // Thứ 2, tiết 2-3
  { dayIdx: 1, day: "Tuesday", positions: [0, 1] },   // Thứ 3, tiết 1-2
  // ...
]

// Thử position đầu tiên
assignToSlot(variable, domain[0], timetable);
// → Timetable[0].periods[1] = { subject: "Toán", teacher: "GV1" }
// → Timetable[0].periods[2] = { subject: "Toán", teacher: "GV1" }

// Forward check: Các variables còn lại có domain không?
if (forwardCheck(remainingVars, domainCache)) {
  // Đệ quy: Xếp các variables còn lại
  if (backtrack(remainingVars, timetable)) {
    return true; // ✅ Thành công
  }
}

// Nếu fail → Remove và thử position tiếp theo
removeAssignment(variable, domain[0], keys, timetable);
```

---

## 📊 Ví Dụ Cụ Thể

### **Input**

```javascript
// Lớp: 10A1
// Môn học:
// - Toán: 4 tiết/tuần, GV Nguyễn Văn A, maxPerDay = 2
// - Văn: 3 tiết/tuần, GV Trần Thị B, maxPerDay = 2
// - Lý: 2 tiết/tuần, GV Lê Văn C, maxPerDay = 1

// Hoạt động cố định:
// - Chào cờ: Thứ 2, tiết 1
// - Sinh hoạt: Thứ 7, tiết 5

// Lịch rảnh GV Nguyễn Văn A:
// - Thứ 2: [true, true, false, true, true]  // Tiết 3 không rảnh
// - Thứ 3: [true, true, true, true, true]
// - ...
```

### **Quy Trình**

#### **Bước 1: Khởi Tạo**

```
Timetable rỗng:
Monday:    [_, _, _, _, _]
Tuesday:   [_, _, _, _, _]
Wednesday: [_, _, _, _, _]
Thursday:  [_, _, _, _, _]
Friday:    [_, _, _, _, _]
Saturday:  [_, _, _, _, _]
```

#### **Bước 2: Xếp Hoạt Động Cố Định**

```
Monday:    [Chào cờ (locked), _, _, _, _]
Tuesday:   [_, _, _, _, _]
Wednesday: [_, _, _, _, _]
Thursday:  [_, _, _, _, _]
Friday:    [_, _, _, _, _]
Saturday:  [_, _, _, _, Sinh hoạt (locked)]
```

#### **Bước 3: Tạo Variables**

```javascript
variables = [
  { id: "toan-pair-0", subject: "Toán", teacher: "GV A", length: 2 },
  { id: "toan-single-0", subject: "Toán", teacher: "GV A", length: 1 },
  { id: "toan-single-1", subject: "Toán", teacher: "GV A", length: 1 },
  { id: "van-pair-0", subject: "Văn", teacher: "GV B", length: 2 },
  { id: "van-single-0", subject: "Văn", teacher: "GV B", length: 1 },
  { id: "ly-single-0", subject: "Lý", teacher: "GV C", length: 1 },
  { id: "ly-single-1", subject: "Lý", teacher: "GV C", length: 1 }
]
```

#### **Bước 4: Backtracking**

**Iteration 1:**
- Chọn: `toan-pair-0` (MRV - có domain nhỏ nhất)
- Domain: `[{dayIdx: 1, positions: [1, 2]}, {dayIdx: 2, positions: [0, 1]}, ...]`
- Thử: `{dayIdx: 1, positions: [1, 2]}` (Thứ 3, tiết 2-3)
- Assign: ✅
- Forward check: ✅
- Đệ quy: Xếp các variables còn lại

**Iteration 2:**
- Chọn: `toan-single-0`
- Domain: `[{dayIdx: 0, positions: [1]}, {dayIdx: 0, positions: [3]}, ...]`
- Thử: `{dayIdx: 0, positions: [1]}` (Thứ 2, tiết 2)
- ❌ Conflict: Thứ 2 tiết 2 đã có Chào cờ ở tiết 1, không thể xếp pair
- Thử: `{dayIdx: 0, positions: [3]}` (Thứ 2, tiết 4)
- Assign: ✅
- Forward check: ✅
- Đệ quy: Tiếp tục

**... (tiếp tục cho đến khi xếp hết)**

#### **Kết Quả Cuối Cùng**

```
Monday:    [Chào cờ, Toán, Toán, Toán, _]
Tuesday:   [Văn, Toán, Toán, Lý, _]
Wednesday: [Văn, Văn, Lý, _, _]
Thursday:  [_, _, _, _, _]
Friday:    [_, _, _, _, _]
Saturday:  [_, _, _, _, Sinh hoạt]
```

---

## ⚡ Tối Ưu Hóa

### 1. **Domain Caching**

```javascript
// Cache domain để tránh tính lại nhiều lần
const domainCache = new Map();

for (const variable of pendingVars) {
  const cached = domainCache.get(variable.id);
  if (cached) {
    // Sử dụng domain đã cache
  } else {
    // Tính domain mới và cache lại
    const domain = buildDomainForVariable(variable, timetable);
    domainCache.set(variable.id, domain);
  }
}
```

### 2. **Early Termination**

```javascript
// Giới hạn số lần iteration
const maxIterations = 200000;
let iterations = 0;

function backtrack(...) {
  iterations++;
  if (iterations > maxIterations) {
    return false; // ❌ Vượt quá giới hạn
  }
  // ...
}
```

### 3. **Retry với Cấu Hình Khác**

```javascript
// Thử với allowPairs = true (ưu tiên tiết liền kề)
let result = attemptSolve(true);

// Nếu fail → thử với allowPairs = false (linh hoạt hơn)
if (!result.success) {
  result = attemptSolve(false);
}
```

### 4. **Parallel Processing**

```javascript
// Xử lý từng lớp độc lập (có thể parallel)
for (const classObj of classes) {
  const result = solveClassWithBacktracking({
    classObj,
    // ...
  });
  
  results.push(result);
}
```

---

## 🎓 Kết Luận

Thuật toán Backtracking với CSP là một giải pháp mạnh mẽ để tạo thời khóa biểu tự động, đảm bảo:

- ✅ **Chính xác:** Tuân thủ tất cả ràng buộc
- ✅ **Hiệu quả:** Sử dụng MRV và Forward Checking để giảm backtracking
- ✅ **Linh hoạt:** Hỗ trợ nhiều cấu hình (pair, single, session, v.v.)
- ✅ **Mở rộng:** Dễ dàng thêm ràng buộc mới

**Độ phức tạp:**
- **Time Complexity:** O(b^d) trong trường hợp xấu nhất (b = branching factor, d = depth)
- **Space Complexity:** O(d) cho recursion stack
- **Thực tế:** Với MRV và Forward Checking, thường tìm được giải pháp trong O(n²) đến O(n³)

**Cải thiện có thể:**
- Arc Consistency (AC-3)
- Constraint Propagation
- Local Search (Simulated Annealing, Genetic Algorithm)
- Machine Learning để học heuristic tốt hơn


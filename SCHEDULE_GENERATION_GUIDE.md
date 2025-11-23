# 📚 Hướng Dẫn Tạo Lịch Học Tự Động

## 🎯 Tổng Quan

Hệ thống tạo lịch học tự động dựa trên các dữ liệu và cấu hình sau:

---

## 📋 1. Dữ Liệu Cần Thiết

### 1.1. **ScheduleConfig** (Cấu hình thời khóa biểu)
**File:** `backend/src/models/subject/scheduleConfig.js`

**Các thông tin quan trọng:**
- **`days`** (Map): Cấu hình số tiết/ngày
  - `morningPeriods`: Số tiết buổi sáng
  - `afternoonPeriods`: Số tiết buổi chiều
  - `totalPeriods`: Tổng số tiết/ngày
  - Ví dụ: `{ "Monday": { morningPeriods: 5, afternoonPeriods: 4, totalPeriods: 9 } }`

- **`subjectHours`** (Map): Số tiết/tuần cho từng môn học theo khối
  - `periodsPerWeek`: Map theo khối `{ "10": 4, "11": 4, "12": 4 }`
  - `gradeConfigs`: Cấu hình theo khối
    - `maxPeriodsPerDay`: Tối đa tiết/ngày
    - `allowConsecutive`: Cho phép tiết liên tiếp (Toán, Ngữ văn)
    - `session`: "main" (buổi chính) hoặc "extra" (buổi phụ)
  - Ví dụ: `{ "Toán": { periodsPerWeek: Map([["10", 4], ["11", 4]]), gradeConfigs: {...} } }`

- **`activities`** (Array): Cấu hình hoạt động
  - `activityId`: ID hoạt động
  - `periodsPerWeek`: Map theo khối `{ "10": 2, "11": 2, "12": 2 }`
  - `session`: "main" hoặc "extra"
  - `gradeConfigs`: Cấu hình theo khối
    - `dayOfWeek`: Ngày trong tuần (ví dụ: "Monday")
    - `timeSlot`: Tiết học/Khung giờ (ví dụ: "Tiết 1")
  - `fixedSlots`: Các slot cố định `[{ day: "Monday", periods: [1, 2] }]`
  - `isPermanent`: Hoạt động vĩnh viễn
  - `startDate`, `endDate`: Ngày bắt đầu/kết thúc (nếu không vĩnh viễn)

- **`gradeSessionRules`** (Array): Quy tắc buổi học cho từng khối
  - `grade`: "10", "11", "12"
  - `session`: "morning" (sáng), "afternoon" (chiều), "both" (cả hai)
  - Ví dụ: `[{ grade: "10", session: "morning" }, { grade: "11", session: "afternoon" }]`

- **Cấu hình chung:**
  - `defaultStartTimeMorning`: Giờ bắt đầu buổi sáng (ví dụ: "07:00")
  - `defaultStartTimeAfternoon`: Giờ bắt đầu buổi chiều (ví dụ: "13:00")
  - `minutesPerPeriod`: Thời lượng mỗi tiết (mặc định: 45 phút)
  - `defaultBreakMinutes`: Thời gian nghỉ giữa các tiết (mặc định: 5 phút)
  - `specialBreaks`: Các giờ nghỉ đặc biệt

### 1.2. **TeachingAssignment** (Phân công giảng dạy)
**File:** `backend/src/models/subject/teachingAssignment.js`

**Thông tin:**
- `teacherId`: ID giáo viên
- `subjectId`: ID môn học
- `classId`: ID lớp học
- `year`: Năm học (ví dụ: "2024-2025")
- `semester`: Học kỳ ("1" hoặc "2")

**Mục đích:** Xác định giáo viên nào dạy môn nào, lớp nào trong năm học/học kỳ cụ thể.

### 1.3. **Class** (Lớp học)
**File:** `backend/src/models/class/class.js`

**Thông tin:**
- `_id`: ID lớp
- `className`: Tên lớp (ví dụ: "10A1")
- `grade`: Khối ("10", "11", "12")
- `year`: Năm học

**Mục đích:** Danh sách các lớp cần tạo lịch học.

### 1.4. **Subject** (Môn học)
**File:** `backend/src/models/subject/subject.js`

**Thông tin:**
- `_id`: ID môn học
- `name`: Tên môn học (ví dụ: "Toán", "Ngữ văn")
- `grades`: Mảng khối áp dụng `["10", "11", "12"]`
- `isActive`: Trạng thái hoạt động (mặc định: `true`)

**Lưu ý:** Chỉ môn học `isActive: true` mới được đưa vào lịch học.

### 1.5. **Activity** (Hoạt động)
**File:** `backend/src/models/subject/activity.js`

**Thông tin:**
- `_id`: ID hoạt động
- `name`: Tên hoạt động
- `type`: "weekly" (hàng tuần) hoặc "special" (đặc biệt)
- `grades`: Mảng khối áp dụng `["10", "11", "12"]`
- `isActive`: Trạng thái hoạt động

**Lưu ý:** Cấu hình chi tiết (dayOfWeek, timeSlot, periodsPerWeek) được lưu trong `ScheduleConfig.activities`, không phải trong model `Activity`.

### 1.6. **Teacher** (Giáo viên)
**File:** `backend/src/models/user/teacher.js`

**Thông tin quan trọng:**
- `_id`: ID giáo viên
- `name`: Tên giáo viên
- **`availableMatrix`**: Ma trận rảnh của giáo viên
  - Cấu trúc: `boolean[][]` (mảng 2 chiều)
  - `availableMatrix[dayIndex][periodIndex]`
    - `dayIndex`: 0 = Monday, 1 = Tuesday, ..., 5 = Saturday
    - `periodIndex`: 0 = Tiết 1, 1 = Tiết 2, ...
  - `true` = Rảnh, `false` = Bận
  - Ví dụ: `availableMatrix[0][0] = true` → Giáo viên rảnh vào Thứ 2, Tiết 1

**Mục đích:** Kiểm tra giáo viên có rảnh vào thời điểm cụ thể không, tránh xung đột.

---

## 🔄 2. Quy Trình Tạo Lịch Học

### 2.1. **Bước 1: Lấy dữ liệu cần thiết**
```javascript
// 1. Lấy cấu hình thời khóa biểu
const config = await ScheduleConfig.findOne();

// 2. Lấy danh sách môn học (chỉ active)
const subjects = await Subject.find({ isActive: true });

// 3. Lấy danh sách hoạt động (chỉ active)
const activities = await Activity.find({ isActive: true });

// 4. Lấy danh sách lớp học theo khối
const classes = await Class.find({ 
  grade: { $in: grades }, // grades = ["10", "11", "12"]
  year: year 
});

// 5. Lấy phân công giảng dạy
const assignments = await TeachingAssignment.find({
  year: year,
  semester: semester
}).populate('teacherId').populate('subjectId').populate('classId');

// 6. Lấy thông tin giáo viên (để lấy availableMatrix)
// (Thường đã được populate trong assignments)
```

### 2.2. **Bước 2: Khởi tạo lịch học trống cho từng lớp**
```javascript
// Với mỗi lớp:
const timetable = [];

// Duyệt qua các ngày trong tuần
for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) {
  const dayConfig = config.days[day];
  if (!dayConfig) continue;
  
  const totalPeriods = dayConfig.totalPeriods;
  const periods = Array.from({ length: totalPeriods }, (_, idx) => ({
    period: idx + 1,
    subject: "",
    teacher: ""
  }));
  
  timetable.push({ day, periods });
}
```

### 2.3. **Bước 3: Xếp các hoạt động cố định trước**
```javascript
// Duyệt qua các hoạt động trong config.activities
for (const activityConfig of config.activities) {
  // Kiểm tra hoạt động có áp dụng cho khối này không
  const activity = activities.find(a => a._id.toString() === activityConfig.activityId.toString());
  if (!activity || !activity.grades.includes(grade)) continue;
  
  // Lấy cấu hình theo khối
  const gradeConfig = activityConfig.gradeConfigs?.[grade];
  
  // Nếu có fixedSlots, xếp vào các slot cố định
  if (activityConfig.fixedSlots && activityConfig.fixedSlots.length > 0) {
    for (const slot of activityConfig.fixedSlots) {
      const dayIndex = getDayIndex(slot.day);
      for (const periodNum of slot.periods) {
        timetable[dayIndex].periods[periodNum - 1].subject = activity.name;
        timetable[dayIndex].periods[periodNum - 1].teacher = ""; // Hoạt động không có giáo viên
        // Đánh dấu slot này đã bị khóa
      }
    }
  }
  
  // Nếu có dayOfWeek và timeSlot trong gradeConfig, xếp vào slot đó
  if (gradeConfig?.dayOfWeek && gradeConfig?.timeSlot) {
    // Xử lý logic xếp vào slot cụ thể
  }
}
```

### 2.4. **Bước 4: Xếp các môn học**
```javascript
// Lấy danh sách môn học cho khối này từ config.subjectHours
const subjectsForGrade = getSubjectsForGrade(grade, config, subjects);

// Sắp xếp theo độ ưu tiên (ví dụ: môn có nhiều tiết trước)
subjectsForGrade.sort((a, b) => b.periodsPerWeek - a.periodsPerWeek);

// Với mỗi môn học:
for (const subjectItem of subjectsForGrade) {
  const subjectName = subjectItem.name;
  const periodsPerWeek = subjectItem.periodsPerWeek; // Lấy theo khối
  const maxPeriodsPerDay = subjectItem.maxPeriodsPerDay;
  const allowConsecutive = subjectItem.allowConsecutive;
  const session = subjectItem.session; // "main" hoặc "extra"
  
  // Tìm giáo viên dạy môn này cho lớp này
  const teacher = findTeacherForSubject(subjectName, classId, assignments);
  
  let placedCount = 0;
  let attempts = 0;
  const maxAttempts = 500;
  
  // Xếp môn học vào lịch
  while (placedCount < periodsPerWeek && attempts < maxAttempts) {
    attempts++;
    
    // Chọn ngẫu nhiên một ngày và tiết
    const dayIndex = getRandomInt(0, timetable.length - 1);
    const day = timetable[dayIndex];
    
    // Xác định phạm vi tiết dựa trên session
    let periodStart, periodEnd;
    if (session === "main") {
      // Buổi chính: dựa vào gradeSessionRules
      const mainSession = getMainSessionForGrade(grade);
      if (mainSession === "morning") {
        periodStart = 0;
        periodEnd = dayConfig.morningPeriods;
      } else if (mainSession === "afternoon") {
        periodStart = dayConfig.morningPeriods;
        periodEnd = dayConfig.totalPeriods;
      } else { // "both"
        periodStart = 0;
        periodEnd = dayConfig.totalPeriods;
      }
    } else { // "extra"
      // Buổi phụ: ngược lại với buổi chính
      // ...
    }
    
    const periodIndex = getRandomInt(periodStart, periodEnd - 1);
    const slot = day.periods[periodIndex];
    
    // Kiểm tra điều kiện:
    // 1. Slot chưa có môn học
    // 2. Slot chưa bị khóa (bởi hoạt động cố định)
    // 3. Chưa vượt quá maxPeriodsPerDay cho ngày này
    // 4. Nếu không cho phép liên tiếp, kiểm tra không trùng với tiết trước/sau
    // 5. Giáo viên rảnh (kiểm tra availableMatrix)
    // 6. Giáo viên không trùng với lớp khác cùng tiết
    
    if (
      !slot.subject &&
      !slot.locked &&
      getPeriodsInDay(day, subjectName) < maxPeriodsPerDay &&
      (!allowConsecutive || isValidPlacement(day, periodIndex, subjectName)) &&
      isTeacherAvailable(teacher.id, day.day, periodIndex + 1) &&
      !hasTeacherConflict(teacher.id, day.day, periodIndex + 1)
    ) {
      // Xếp môn học vào slot
      slot.subject = subjectName;
      slot.teacher = teacher.name;
      placedCount++;
      
      // Nếu cho phép liên tiếp và còn thiếu tiết, thử xếp tiết tiếp theo
      if (allowConsecutive && placedCount < periodsPerWeek && periodIndex + 1 < periodEnd) {
        const nextSlot = day.periods[periodIndex + 1];
        if (
          !nextSlot.subject &&
          !nextSlot.locked &&
          isTeacherAvailable(teacher.id, day.day, periodIndex + 2) &&
          !hasTeacherConflict(teacher.id, day.day, periodIndex + 2)
        ) {
          nextSlot.subject = subjectName;
          nextSlot.teacher = teacher.name;
          placedCount++;
        }
      }
    }
  }
}
```

### 2.5. **Bước 5: Xếp các hoạt động linh hoạt**
```javascript
// Tương tự như môn học, nhưng:
// - Không cần giáo viên
// - Không cần kiểm tra availableMatrix
// - Không cần kiểm tra xung đột giáo viên
```

### 2.6. **Bước 6: Kiểm tra và xử lý xung đột**
```javascript
// Kiểm tra xung đột giáo viên giữa các lớp
function hasTeacherConflict(teacherId, day, period, currentClassId) {
  for (const otherSchedule of allSchedules) {
    if (otherSchedule.classId === currentClassId) continue;
    
    const otherDay = otherSchedule.timetable.find(d => d.day === day);
    if (!otherDay) continue;
    
    const otherPeriod = otherDay.periods[period - 1];
    if (otherPeriod && otherPeriod.teacher === teacherId) {
      return true; // Xung đột!
    }
  }
  return false;
}

// Nếu có xung đột, thử tạo lại lịch (tối đa N lần)
let conflictAttempts = 0;
const maxAttempts = 10;

while (hasTeacherConflict(...) && conflictAttempts < maxAttempts) {
  conflictAttempts++;
  // Tạo lại lịch học
  timetable = generateScheduleForClass(...);
}
```

### 2.7. **Bước 7: Lưu lịch học vào database**
```javascript
// Với mỗi lớp:
const schedule = new Schedule({
  classId: classId,
  className: className,
  year: year,
  semester: semester,
  timetable: timetable // [{ day: "Monday", periods: [...] }, ...]
});

// Xóa lịch cũ nếu có
await Schedule.deleteMany({
  classId: classId,
  year: year,
  semester: semester
});

// Lưu lịch mới
await schedule.save();
```

---

## 🎯 3. Các Ràng Buộc Quan Trọng

### 3.1. **Ràng buộc về số tiết**
- Mỗi môn học phải đủ số tiết/tuần theo `periodsPerWeek` (theo khối)
- Không vượt quá `maxPeriodsPerDay` cho mỗi ngày
- Tổng số tiết buổi chính (môn học + hoạt động) không vượt quá số tiết buổi chính có sẵn

### 3.2. **Ràng buộc về giáo viên**
- Giáo viên phải rảnh (kiểm tra `availableMatrix`)
- Giáo viên không được dạy 2 lớp cùng một tiết
- Giáo viên phải được phân công dạy môn đó cho lớp đó (trong `TeachingAssignment`)

### 3.3. **Ràng buộc về hoạt động**
- Hoạt động cố định (`fixedSlots`, `dayOfWeek` + `timeSlot`) phải được xếp trước
- Hoạt động vĩnh viễn (`isPermanent: true`) không cần kiểm tra `startDate`/`endDate`
- Hoạt động không vĩnh viễn chỉ áp dụng trong khoảng `startDate` - `endDate`

### 3.4. **Ràng buộc về tiết liên tiếp**
- Chỉ môn học có `allowConsecutive: true` (Toán, Ngữ văn) mới được xếp liên tiếp
- Các môn khác không được xếp liên tiếp

### 3.5. **Ràng buộc về buổi học**
- Môn học/hoạt động `session: "main"` phải xếp vào buổi chính (theo `gradeSessionRules`)
- Môn học/hoạt động `session: "extra"` phải xếp vào buổi phụ

---

## 📝 4. Ví Dụ Cụ Thể

### 4.1. **Cấu hình môn học "Toán" cho Khối 10:**
```javascript
config.subjectHours = {
  "Toán": {
    periodsPerWeek: Map([["10", 4], ["11", 4], ["12", 4]]),
    gradeConfigs: Map([
      ["10", {
        maxPeriodsPerDay: 2,
        allowConsecutive: true, // ✅ Cho phép liên tiếp
        session: "main"
      }]
    ])
  }
}
```

### 4.2. **Cấu hình hoạt động "Chào cờ" cho Khối 10:**
```javascript
config.activities = [{
  activityId: ObjectId("..."),
  periodsPerWeek: Map([["10", 1], ["11", 1], ["12", 1]]),
  session: "main",
  gradeConfigs: Map([
    ["10", {
      dayOfWeek: "Monday", // ✅ Thứ 2
      timeSlot: "Tiết 1"    // ✅ Tiết 1
    }]
  ]),
  isPermanent: true
}]
```

### 4.3. **Ma trận rảnh của giáo viên:**
```javascript
teacher.availableMatrix = [
  [true, true, true, true, true],   // Monday: Tiết 1-5 đều rảnh
  [true, true, false, true, true],   // Tuesday: Tiết 3 bận
  [true, true, true, true, true],   // Wednesday: Tất cả rảnh
  [true, true, true, true, true],   // Thursday: Tất cả rảnh
  [true, true, true, true, true],   // Friday: Tất cả rảnh
  [false, false, false, false, false] // Saturday: Tất cả bận
]
```

---

## 🔧 5. API Endpoints

### 5.1. **Tạo lịch học tự động**
```
POST /api/schedules/auto-generate
Body: {
  grades: ["10", "11", "12"],
  year: "2024-2025",
  semester: "1"
}
```

**File:** `backend/src/controllers/subject/autoScheduleController.js`

---

## 📌 6. Lưu Ý Quan Trọng

1. **Chỉ môn học/hoạt động `isActive: true` mới được đưa vào lịch học**
2. **Cấu hình `periodsPerWeek` là theo khối**, cần lấy đúng giá trị cho khối đang xử lý
3. **Hoạt động cố định phải được xếp trước** các môn học/hoạt động linh hoạt
4. **Kiểm tra xung đột giáo viên** giữa các lớp là bắt buộc
5. **Ma trận rảnh của giáo viên (`availableMatrix`)** phải được cập nhật khi giáo viên có lịch bận
6. **Nếu không tìm được slot phù hợp**, hệ thống sẽ thử lại (tối đa N lần) hoặc báo lỗi

---

## 🚀 7. Bước Tiếp Theo

Để triển khai tính năng tạo lịch học tự động, bạn cần:

1. ✅ **Đã có:** ScheduleConfig, Subject, Activity, Class, TeachingAssignment, Teacher models
2. ✅ **Đã có:** AutoScheduleGenerator class trong `backend/src/controllers/subject/autoScheduleController.js`
3. ⚠️ **Cần kiểm tra:** Logic xử lý `gradeConfigs` trong `periodsPerWeek` và `activities`
4. ⚠️ **Cần kiểm tra:** Logic xử lý `dayOfWeek` và `timeSlot` trong `gradeConfigs` của activities
5. ⚠️ **Cần kiểm tra:** Logic xử lý `fixedSlots` trong activities
6. ⚠️ **Cần kiểm tra:** Logic xử lý `isPermanent`, `startDate`, `endDate` của activities
7. 🔄 **Cần cập nhật:** Frontend để gọi API và hiển thị kết quả

---

**Tài liệu này sẽ giúp bạn hiểu rõ cách hệ thống tạo lịch học tự động dựa trên các dữ liệu và cấu hình đã có.**



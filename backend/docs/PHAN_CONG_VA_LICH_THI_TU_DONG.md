# 📚 Tài Liệu: Phân Công Tự Động và Tạo Lịch Thi Tự Động

## 📋 Mục Lục

1. [Tổng Quan](#tổng-quan)
2. [Phân Công Giảng Dạy Tự Động](#phân-công-giảng-dạy-tự-động)
3. [Tạo Lịch Thi Tự Động](#tạo-lịch-thi-tự-động)
4. [So Sánh và Mối Quan Hệ](#so-sánh-và-mối-quan-hệ)

---

## 🎯 Tổng Quan

Hệ thống cung cấp 2 chức năng tự động hóa quan trọng:

1. **Phân Công Giảng Dạy Tự Động**: Tự động gán giáo viên cho các môn học của các lớp
2. **Tạo Lịch Thi Tự Động**: Tự động tạo lịch thi cho các môn học trong kỳ thi

Cả hai chức năng đều sử dụng các thuật toán thông minh để đảm bảo:
- ✅ Tuân thủ các ràng buộc nghiệp vụ
- ✅ Cân bằng tải giữa các giáo viên
- ✅ Tối ưu hóa việc sử dụng tài nguyên

---

## 📝 Phân Công Giảng Dạy Tự Động

### 🎯 Mục Đích

Tự động phân công giáo viên dạy các môn học cho các lớp học, đảm bảo:
- Mỗi lớp có đủ giáo viên cho tất cả các môn học
- Giáo viên không bị quá tải (số lớp, số tiết/tuần)
- Phân bổ công bằng giữa các giáo viên cùng môn
- Tuân thủ quyền hạn của giáo viên (môn học, khối lớp)

### 📍 Vị Trí Code

- **Backend**: `backend/src/controllers/subject/autoAssignTeachingController.js`
- **Endpoint**: `POST /api/teaching-assignment/auto-assign`
- **Hàm chính**: `calculateAutoAssignments()`

### 🔧 Các Ràng Buộc (Constraints)

#### 1. **Ràng Buộc Giáo Viên**

```javascript
// ✅ 1. Giáo viên chỉ có thể dạy môn học của họ
const hasSubject = t.subjects?.some(s => {
  const sSubjectId = s.subjectId?._id?.toString() || s.subjectId?.toString();
  return sSubjectId === subjectIdStr;
}) || t.mainSubject?.toString() === subjectIdStr;

// ✅ 2. Giáo viên chỉ có thể dạy những khối họ được phân quyền
const canTeachGrade = t.subjects?.some(s => {
  const sSubjectId = s.subjectId?._id?.toString() || s.subjectId?.toString();
  const sGrades = s.grades || [];
  return sSubjectId === subjectIdStr && sGrades.includes(classGrade);
});

// ✅ 3. Không vượt maxClasses (số lớp tối đa)
const currentLoad = teacherLoadMap.get(teacherId) || 0;
const effectiveMaxClasses = maxClassPerGradeForThisGrade > 0 
  ? maxClassPerGradeForThisGrade 
  : Math.min(calculatedMax, teacherMaxClasses);
const withinClassLimit = currentLoad < effectiveMaxClasses;

// ✅ 4. Không vượt weeklyLessons (số tiết/tuần tối đa)
const currentWeeklyLessons = teacherWeeklyLessonsMap.get(teacherId) || 0;
const maxWeeklyLessons = teacher.effectiveWeeklyLessons || 17;
const periodsPerWeek = await getSubjectPeriodsPerWeek(subjectId, classGrade, scheduleConfig);
const withinWeeklyLessonsLimit = (currentWeeklyLessons + periodsPerWeek) <= maxWeeklyLessons;

// ✅ 5. Không vượt maxClassPerGrade (số lớp tối đa cho mỗi khối)
const gradeCount = teacherGradeCountMap.get(teacherId)?.get(classGrade) || 0;
const maxClassPerGrade = teacher.maxClassPerGrade?.[classGrade] || 0;
const withinGradeLimit = maxClassPerGrade === 0 || gradeCount < maxClassPerGrade;
```

#### 2. **Ràng Buộc Phân Bổ**

```javascript
// ✅ 6. Tránh trường hợp nhiều GV cùng môn dồn vào 1 khối, phải chia đều
const subjectGradeKey = `${subjectId}-${classGrade}`;
const subjectGradeCount = teacherSubjectGradeCountMap.get(teacherId)?.get(subjectGradeKey) || 0;
// Ưu tiên giáo viên có ít lớp hơn cho môn/khối này

// ✅ 7. Ưu tiên mainSubject (môn chính của giáo viên)
const isMainSubject = teacher.mainSubject?.toString() === subjectIdStr;
// Giáo viên có môn chính sẽ được ưu tiên hơn

// ✅ 8. Ưu tiên giáo viên ít lớp nhất (balance load)
const loadRatio = currentLoad / effectiveMaxClasses; // Tỷ lệ tải
// Giáo viên có loadRatio thấp hơn sẽ được ưu tiên
```

### 🔄 Quy Trình Thực Hiện

#### **Bước 1: Khởi Tạo và Lọc Dữ Liệu**

```javascript
// 1. Lọc lớp theo khối
const targetClasses = classes.filter(c => grades.includes(String(c.grade)));

// 2. Lọc môn học có ít nhất một khối trong grades
const classSubjects = subjects.filter(s => {
  if (!s.grades || !s.grades.includes(String(cls.grade))) return false;
  if (s.isActive === false) return false;
  return true;
});

// 3. Lọc giáo viên: status='active', isLeader != true, isDeleted != true
const candidateTeachers = teachers.filter(t => {
  if (t.isLeader) return false;
  if (t.status !== 'active') return false;
  return true;
});
```

#### **Bước 2: Khởi Tạo Counters và Maps**

```javascript
// Track số lớp mỗi giáo viên đang dạy (tổng)
const teacherLoadMap = new Map(); // teacherId -> số lớp

// Track số tiết/tuần mỗi giáo viên đang dạy
const teacherWeeklyLessonsMap = new Map(); // teacherId -> số tiết/tuần

// Track số tiết mỗi giáo viên dạy cho mỗi môn (để cân bằng)
const teacherSubjectLessonsMap = new Map(); // teacherId -> Map(subjectId -> số tiết)

// Track số lớp mỗi giáo viên dạy cho mỗi môn/khối (để chia đều)
const teacherSubjectGradeCountMap = new Map(); // teacherId -> Map(subjectId-grade -> số lớp)

// Track số lớp mỗi giáo viên dạy cho mỗi khối (để kiểm tra maxClassPerGrade)
const teacherGradeCountMap = new Map(); // teacherId -> Map(grade -> số lớp)
```

#### **Bước 3: Tính Tải Hiện Tại Từ Phân Công Cũ**

```javascript
// Lấy phân công hiện có (cùng năm học và học kỳ)
const currentYearAssignments = existingAssignments.filter(a => a.year === year);
const currentSemesterAssignments = currentYearAssignments.filter(a => a.semester === semester);

// Cập nhật tất cả counters và maps
for (const assignment of currentSemesterAssignments) {
  const teacherId = assignment.teacherId?._id?.toString();
  const subjectId = assignment.subjectId?._id?.toString();
  const classGrade = String(assignment.classId?.grade || '10');
  
  // Cập nhật số lớp (tổng)
  teacherLoadMap.set(teacherId, (teacherLoadMap.get(teacherId) || 0) + 1);
  
  // Cập nhật số tiết/tuần
  const periodsPerWeek = await getSubjectPeriodsPerWeek(subjectId, classGrade, scheduleConfig);
  teacherWeeklyLessonsMap.set(teacherId, (teacherWeeklyLessonsMap.get(teacherId) || 0) + periodsPerWeek);
  
  // Cập nhật số tiết cho môn này
  const subjectLessonsMap = teacherSubjectLessonsMap.get(teacherId);
  subjectLessonsMap.set(subjectId, (subjectLessonsMap.get(subjectId) || 0) + periodsPerWeek);
  
  // Cập nhật số lớp cho môn/khối cụ thể
  const subjectGradeKey = `${subjectId}-${classGrade}`;
  const subjectGradeMap = teacherSubjectGradeCountMap.get(teacherId);
  subjectGradeMap.set(subjectGradeKey, (subjectGradeMap.get(subjectGradeKey) || 0) + 1);
  
  // Cập nhật số lớp cho khối
  const gradeMap = teacherGradeCountMap.get(teacherId);
  gradeMap.set(classGrade, (gradeMap.get(classGrade) || 0) + 1);
}
```

#### **Bước 4: Tạo Tasks (Lớp + Môn)**

```javascript
// Tạo danh sách tasks cần phân công
const tasks = [];
for (const cls of targetClasses) {
  const classSubjects = subjects.filter(s => {
    if (!s.grades || !s.grades.includes(String(cls.grade))) return false;
    if (s.isActive === false) return false;
    return true;
  });
  
  for (const subj of classSubjects) {
    const classId = cls._id.toString();
    const subjectId = subj._id.toString();
    
    // Bỏ qua nếu đã có phân công
    if (assignedMap.get(classId)?.has(subjectId)) continue;
    
    tasks.push({
      classId: cls._id,
      className: cls.className,
      classGrade: String(cls.grade),
      subjectId: subj._id,
      subjectName: subj.name,
    });
  }
}

// ✅ Shuffle tasks để tránh thiên vị theo thứ tự lớp
const shuffledTasks = [...tasks];
for (let i = shuffledTasks.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [shuffledTasks[i], shuffledTasks[j]] = [shuffledTasks[j], shuffledTasks[i]];
}
```

#### **Bước 5: Xử Lý Từng Task**

```javascript
for (const task of shuffledTasks) {
  const { classId, className, classGrade, subjectId, subjectName } = task;
  
  // ✅ Nếu là học kỳ 2 → ưu tiên giáo viên đã dạy môn đó ở học kỳ 1
  if (semester === "2") {
    const prev = currentYearAssignments.find(a => {
      const aClassId = a.classId?._id?.toString();
      const aSubjectId = a.subjectId?._id?.toString();
      return aClassId === classIdStr && 
             aSubjectId === subjectIdStr && 
             a.semester === "1";
    });
    
    if (prev?.teacherId?._id) {
      // Kiểm tra lại các ràng buộc cho giáo viên cũ
      if (await canTeacherTeach(prevTeacher, ...)) {
        selectedTeacher = prevTeacher;
      }
    }
  }
  
  // ✅ Nếu chưa có giáo viên → tìm giáo viên phù hợp
  if (!selectedTeacher) {
    // 1. Lọc giáo viên có thể dạy môn này
    const candidateTeachers = teachers.filter(t => {
      // Kiểm tra tất cả ràng buộc
      return hasSubject && canTeachGrade && withinClassLimit && 
             withinWeeklyLessonsLimit && withinGradeLimit;
    });
    
    // 2. Tính điểm cho mỗi giáo viên
    const scoredTeachers = candidateTeachers.map(t => {
      const teacherId = t._id.toString();
      const currentLoad = teacherLoadMap.get(teacherId) || 0;
      const currentWeeklyLessons = teacherWeeklyLessonsMap.get(teacherId) || 0;
      const periodsPerWeek = await getSubjectPeriodsPerWeek(subjectId, classGrade, scheduleConfig);
      
      // Tính điểm (điểm thấp hơn = tốt hơn)
      let score = 0;
      
      // Ưu tiên số tiết/tuần (quan trọng nhất)
      const weeklyLessonsRatio = (currentWeeklyLessons + periodsPerWeek) / maxWeeklyLessons;
      score += weeklyLessonsRatio * 1000;
      
      // Ưu tiên số lớp (quan trọng thứ hai)
      const loadRatio = currentLoad / effectiveMaxClasses;
      score += loadRatio * 100;
      
      // Ưu tiên mainSubject
      const isMainSubject = t.mainSubject?.toString() === subjectIdStr;
      if (!isMainSubject) score += 10;
      
      // Ưu tiên chia đều môn/khối
      const subjectGradeKey = `${subjectId}-${classGrade}`;
      const subjectGradeCount = teacherSubjectGradeCountMap.get(teacherId)?.get(subjectGradeKey) || 0;
      score += subjectGradeCount * 5;
      
      return { teacher: t, score };
    });
    
    // 3. Sắp xếp theo điểm (điểm thấp hơn = tốt hơn)
    scoredTeachers.sort((a, b) => a.score - b.score);
    
    // 4. Chọn giáo viên tốt nhất (hoặc ngẫu nhiên trong top 3)
    const topCandidates = scoredTeachers.slice(0, 3);
    selectedTeacher = topCandidates[Math.floor(Math.random() * topCandidates.length)]?.teacher;
  }
  
  // ✅ Tạo phân công mới
  if (selectedTeacher) {
    const assignment = {
      teacherId: selectedTeacher._id,
      subjectId: subjectId,
      classId: classId,
      year,
      semester,
    };
    
    newAssignments.push(assignment);
    
    // Cập nhật tất cả counters và maps
    // ...
  } else {
    unassigned.push({ className, subjectName });
  }
}
```

### 📊 Ví Dụ Cụ Thể

**Tình huống:**
- Lớp 10A1 cần giáo viên dạy môn Toán (4 tiết/tuần)
- Có 3 giáo viên Toán: GV A (đang dạy 2 lớp, 8 tiết/tuần), GV B (đang dạy 1 lớp, 4 tiết/tuần), GV C (đang dạy 3 lớp, 12 tiết/tuần)
- Tất cả đều có thể dạy khối 10

**Quá trình chọn:**
1. Tính điểm cho mỗi giáo viên:
   - GV A: (8+4)/17 * 1000 + 2/5 * 100 = 705.88 + 40 = 745.88
   - GV B: (4+4)/17 * 1000 + 1/5 * 100 = 470.59 + 20 = 490.59 ✅ **Tốt nhất**
   - GV C: (12+4)/17 * 1000 + 3/5 * 100 = 941.18 + 60 = 1001.18

2. Chọn GV B vì có điểm thấp nhất (ít tải nhất)

### ⚙️ Các Tham Số Đầu Vào

```javascript
POST /api/teaching-assignment/auto-assign
{
  "year": "2025-2026",
  "semester": "1",
  "grades": ["10", "11", "12"],
  "deleteOld": false,        // Xóa phân công cũ trước khi tạo mới?
  "supplement": false,        // Bổ sung phân công cho lớp chưa có?
  "applyProposals": true      // Áp dụng đề xuất từ trưởng bộ môn?
}
```

---

## 📅 Tạo Lịch Thi Tự Động

### 🎯 Mục Đích

Tự động tạo lịch thi cho các môn học trong kỳ thi, đảm bảo:
- Mỗi môn học có lịch thi riêng
- Không trùng lịch thi giữa các môn cùng khối
- Phân bổ đều trong khoảng thời gian kỳ thi
- Tuân thủ giờ bắt đầu buổi sáng/chiều

### 📍 Vị Trí Code

- **Backend**: `backend/src/controllers/exam/examScheduleController.js`
- **Endpoint**: `POST /api/exam-schedule/auto-generate`
- **Hàm chính**: `autoGenerateSchedules()`

### 🔧 Các Ràng Buộc (Constraints)

#### 1. **Ràng Buộc Thời Gian**

```javascript
// ✅ 1. Lịch thi phải nằm trong khoảng thời gian kỳ thi
const startDate = dayjs(exam.startDate).startOf("day");
const endDate = dayjs(exam.endDate).startOf("day");
// Tất cả lịch thi phải nằm trong [startDate, endDate]

// ✅ 2. Không trùng lịch thi giữa các môn cùng khối
const existingSchedule = await ExamSchedule.findOne({
  exam: examId,
  grade: grade,
  date: targetDate,
  startTime: targetStartTime,
  isDeleted: { $ne: true }
});
// Nếu đã có lịch thi cùng ngày, cùng giờ, cùng khối → bỏ qua

// ✅ 3. Tuân thủ giờ bắt đầu buổi sáng/chiều
const defaultStartTimeMorning = scheduleConfig?.defaultStartTimeMorning || "07:00";
const defaultStartTimeAfternoon = scheduleConfig?.defaultStartTimeAfternoon || "13:00";
// Lịch thi buổi sáng bắt đầu từ defaultStartTimeMorning
// Lịch thi buổi chiều bắt đầu từ defaultStartTimeAfternoon
```

#### 2. **Ràng Buộc Môn Học**

```javascript
// ✅ 4. Mỗi môn học chỉ có 1 lịch thi cho mỗi khối
const existingScheduleForSubject = await ExamSchedule.findOne({
  exam: examId,
  grade: grade,
  subject: subjectId,
  isDeleted: { $ne: true }
});
// Nếu đã có lịch thi cho môn này ở khối này → bỏ qua

// ✅ 5. Chỉ tạo lịch thi cho môn học có trong kỳ thi
const examSubjects = await Subject.find({
  _id: { $in: examClass.subjects },
  isActive: { $ne: false }
});
// Chỉ tạo lịch thi cho các môn học trong examClass.subjects
```

### 🔄 Quy Trình Thực Hiện

#### **Bước 1: Kiểm Tra Đầu Vào**

```javascript
// 1. Kiểm tra examId, grade, examType
if (!examId || grade === undefined || grade === null) {
  return res.status(400).json({ error: "Thiếu examId hoặc grade." });
}

// 2. Lấy thông tin kỳ thi
const exam = await Exam.findById(examId).select("startDate endDate name");
if (!exam) return res.status(404).json({ error: "Không tìm thấy kỳ thi." });

// 3. Kiểm tra kỳ thi có ngày bắt đầu/kết thúc
if (!exam.startDate || !exam.endDate) {
  return res.status(400).json({ error: "Kỳ thi chưa có ngày bắt đầu hoặc kết thúc." });
}

// 4. Tính số ngày trong kỳ thi
const startDate = dayjs(exam.startDate).startOf("day");
const endDate = dayjs(exam.endDate).startOf("day");
const daysCount = endDate.diff(startDate, "day") + 1;
```

#### **Bước 2: Lấy Cấu Hình và Dữ Liệu**

```javascript
// 1. Lấy cấu hình thời khóa biểu
const scheduleConfig = await ScheduleConfig.findOne();
const defaultStartTimeMorning = scheduleConfig?.defaultStartTimeMorning || "07:00";
const defaultStartTimeAfternoon = scheduleConfig?.defaultStartTimeAfternoon || "13:00";

// 2. Lấy ExamClass để biết các môn thi
const examClass = await ExamClass.findOne({ exam: examId, grade });
if (!examClass || !examClass.subjects || examClass.subjects.length === 0) {
  return res.status(404).json({ error: `Không tìm thấy môn thi cho khối ${grade}.` });
}

// 3. Lấy danh sách môn học
const examSubjects = await Subject.find({
  _id: { $in: examClass.subjects },
  isActive: { $ne: false }
}).sort({ name: 1 });

// 4. Lấy lịch thi hiện có (để tránh trùng)
const existingSchedules = await ExamSchedule.find({
  exam: examId,
  grade: grade,
  isDeleted: { $ne: true }
});
```

#### **Bước 3: Tạo Lịch Thi Cho Từng Môn (Round-Robin)**

```javascript
// ✅ Khởi tạo cấu hình
const config = {
  breakBetween: 30,  // Nghỉ 30 phút giữa 2 môn
  maxPerDay: 4,      // Tối đa 4 môn 1 ngày
};

// ✅ Lấy thông tin buổi học của khối từ cấu hình
const gradeConfig = scheduleConfig?.gradeConfigs?.get?.(String(grade)) || 
                   scheduleConfig?.gradeConfigs?.[String(grade)];
const gradeSession = gradeConfig?.rules?.session || "morning"; // "morning", "afternoon", "both"

// ✅ Xác định giờ bắt đầu dựa trên buổi học
let sessionStartHour, sessionStartMinute;
if (gradeSession === "afternoon") {
  sessionStartHour = afternoonHour;
  sessionStartMinute = afternoonMinute;
} else {
  sessionStartHour = morningHour;
  sessionStartMinute = morningMinute;
}

// ✅ Khởi tạo trạng thái
const usedSlotsByDay = {}; // Track các slot đã sử dụng cho mỗi ngày
const newSchedules = [];
let dayIndex = 0; // Bắt đầu từ ngày 0 (Round-Robin)

// ✅ Lọc môn học chưa có lịch thi
const existingSubjectIds = new Set(
  existingSchedules.map(s => s.subject?._id?.toString() || s.subject?.toString())
);
const availableSubjects = examSubjects.filter(
  s => !existingSubjectIds.has(s._id.toString())
);

// ✅ Round-Robin: Phân bổ đều các môn vào các ngày
for (const subj of availableSubjects) {
  let scheduled = false;
  let attempts = 0;
  const duration = subj.defaultExamDuration || 90; // Thời lượng thi (phút)

  // Thử xếp lịch cho môn này
  while (!scheduled && attempts < daysCount * 2) {
    // ✅ Round-Robin: Chọn ngày theo vòng tròn
    const curDate = startDate.add(dayIndex % daysCount, "day");
    const dateKey = curDate.format("YYYY-MM-DD");
    const dayOfWeek = curDate.day();

    // Bỏ qua Chủ nhật
    if (dayOfWeek === 0) {
      dayIndex = (dayIndex + 1) % daysCount;
      attempts++;
      continue;
    }

    usedSlotsByDay[dateKey] = usedSlotsByDay[dateKey] || [];

    // ✅ Nếu ngày này chưa đủ môn (chưa vượt maxPerDay)
    if (usedSlotsByDay[dateKey].length < config.maxPerDay) {
      // ⏰ Tính giờ bắt đầu môn tiếp theo
      let slotStart;
      if (usedSlotsByDay[dateKey].length === 0) {
        // Môn đầu tiên trong ngày bắt đầu từ giờ buổi học của khối
        slotStart = dayjs(curDate).hour(sessionStartHour).minute(sessionStartMinute);
      } else {
        // Bắt đầu sau môn trước + thời gian nghỉ
        const last = usedSlotsByDay[dateKey][usedSlotsByDay[dateKey].length - 1];
        slotStart = dayjs(curDate)
          .hour(last.endHour)
          .minute(last.endMinute)
          .add(config.breakBetween, "minute");
        
        // ✅ Nếu khối học cả hai buổi và đã hết slot buổi sáng, chuyển sang buổi chiều
        if (gradeSession === "both" && slotStart.hour() >= 12) {
          slotStart = dayjs(curDate).hour(afternoonHour).minute(afternoonMinute);
        }
      }

      const startTime = slotStart.format("HH:mm");
      const endTime = slotStart.add(duration, "minute").format("HH:mm");
      const candidateDate = curDate.toDate();

      // ✅ Kiểm tra conflict trong DB
      const conflict = await checkScheduleConflict({
        exam: examId,
        grade: grade,
        date: candidateDate,
        startTime,
        duration,
      });

      if (!conflict) {
        // ✅ Tạo lịch thi mới
        newSchedules.push({
          exam: examId,
          grade: grade,
          subject: subj._id,
          date: candidateDate,
          startTime,
          endTime,
          duration,
          examType: validExamType,
          status: "draft",
        });

        // ✅ Lưu slot để tính giờ kế tiếp
        const [eh, em] = endTime.split(":").map(Number);
        usedSlotsByDay[dateKey].push({
          subject: subj.name,
          start: startTime,
          end: endTime,
          endHour: eh,
          endMinute: em,
        });

        scheduled = true;
      }
    }

    // ✅ Chuyển sang ngày tiếp theo (Round-Robin)
    dayIndex = (dayIndex + 1) % daysCount;
    attempts++;
  }

  if (!scheduled) {
    console.warn(`⚠️ Không tìm thấy slot trống cho môn ${subj.name}`);
  }
}

const allNewSchedules = newSchedules;
```

#### **Bước 4: Lưu Lịch Thi**

```javascript
if (allNewSchedules.length > 0) {
  await ExamSchedule.insertMany(allNewSchedules);
  console.log(`✅ Tổng cộng tạo ${allNewSchedules.length} lịch thi.`);
  
  res.json({
    success: true,
    message: `Đã tạo ${allNewSchedules.length} lịch thi mới cho khối ${grade}.`,
    schedules: allNewSchedules,
  });
} else {
  res.json({
    success: false,
    message: "Không tạo được lịch thi mới (có thể đã có đủ lịch thi hoặc không có slot trống).",
  });
}
```

### 📊 Ví Dụ Cụ Thể

**Tình huống:**
- Kỳ thi: 15/01/2025 (Thứ 2) - 20/01/2025 (Thứ 7) - 6 ngày (bỏ qua Chủ nhật)
- Khối 10 có 5 môn thi: Toán, Văn, Anh, Lý, Hóa
- Giờ bắt đầu: Sáng 07:00
- Thời lượng thi: 90 phút
- Nghỉ giữa các môn: 30 phút
- Tối đa 4 môn/ngày

**Quá trình tạo (Round-Robin):**

**Lần 1 (dayIndex = 0):**
- **Toán**: Ngày 0 (15/01) → 07:00-08:30 ✅
- **Văn**: Ngày 1 (16/01) → 07:00-08:30 ✅
- **Anh**: Ngày 2 (17/01) → 07:00-08:30 ✅
- **Lý**: Ngày 3 (18/01) → 07:00-08:30 ✅
- **Hóa**: Ngày 4 (19/01) → 07:00-08:30 ✅

**Kết quả:** Tạo được 5 lịch thi, phân bổ đều trong 5 ngày (mỗi ngày 1 môn).

**Ví dụ với nhiều môn hơn (10 môn):**

**Lần 1 (dayIndex = 0-4):**
- Toán → 15/01, 07:00-08:30
- Văn → 16/01, 07:00-08:30
- Anh → 17/01, 07:00-08:30
- Lý → 18/01, 07:00-08:30
- Hóa → 19/01, 07:00-08:30

**Lần 2 (dayIndex = 0-4, tiếp tục Round-Robin):**
- Sinh → 15/01, 09:00-10:30 (sau Toán + 30 phút nghỉ)
- Sử → 16/01, 09:00-10:30 (sau Văn + 30 phút nghỉ)
- Địa → 17/01, 09:00-10:30 (sau Anh + 30 phút nghỉ)
- GDCD → 18/01, 09:00-10:30 (sau Lý + 30 phút nghỉ)
- Tin → 19/01, 09:00-10:30 (sau Hóa + 30 phút nghỉ)

**Kết quả:** Tạo được 10 lịch thi, phân bổ đều trong 5 ngày (mỗi ngày 2 môn).

### ⚙️ Các Tham Số Đầu Vào

```javascript
POST /api/exam-schedule/auto-generate
{
  "examId": "exam123",
  "grade": "10",
  "examType": "midterm"  // "midterm" hoặc "final"
}
```

---

## 🔄 So Sánh và Mối Quan Hệ

### 📊 Bảng So Sánh

| Tiêu Chí | Phân Công Tự Động | Tạo Lịch Thi Tự Động |
|----------|-------------------|----------------------|
| **Mục đích** | Gán giáo viên cho môn/lớp | Tạo lịch thi cho môn trong kỳ thi |
| **Đầu vào** | Lớp, môn học, giáo viên | Kỳ thi, khối, môn thi |
| **Ràng buộc chính** | Số lớp, số tiết/tuần, quyền hạn | Thời gian, không trùng lịch |
| **Thuật toán** | Greedy + Scoring | First-Fit + Round-Robin |
| **Kết quả** | TeachingAssignment | ExamSchedule |
| **Phụ thuộc** | Cần có lớp, môn, giáo viên | Cần có kỳ thi, ExamClass |

### 🔗 Mối Quan Hệ

1. **Phân Công Tự Động → Tạo Thời Khóa Biểu Tự Động**
   - Phân công tự động tạo ra `TeachingAssignment`
   - Thời khóa biểu tự động sử dụng `TeachingAssignment` để biết giáo viên nào dạy môn nào

2. **Tạo Lịch Thi Tự Động → Phân Phòng Thi Tự Động**
   - Tạo lịch thi tự động tạo ra `ExamSchedule`
   - Phân phòng thi tự động sử dụng `ExamSchedule` để biết lịch thi nào cần phân phòng

3. **Cả Hai → Quản Lý Kỳ Thi**
   - Phân công tự động đảm bảo có giáo viên dạy
   - Tạo lịch thi tự động đảm bảo có lịch thi
   - Cả hai đều cần thiết để quản lý kỳ thi hoàn chỉnh

### ✅ Lưu Ý Quan Trọng

1. **Thứ Tự Thực Hiện:**
   - ✅ Bước 1: Phân công tự động (tạo TeachingAssignment)
   - ✅ Bước 2: Tạo thời khóa biểu tự động (sử dụng TeachingAssignment)
   - ✅ Bước 3: Tạo kỳ thi
   - ✅ Bước 4: Tạo lịch thi tự động (tạo ExamSchedule)
   - ✅ Bước 5: Phân phòng thi tự động (sử dụng ExamSchedule)

2. **Ràng Buộc Chéo:**
   - Phân công tự động không kiểm tra lịch rảnh chi tiết (chỉ kiểm tra availableMatrix có ít nhất 1 slot rảnh)
   - Thời khóa biểu tự động mới kiểm tra lịch rảnh chi tiết khi xếp lịch

3. **Tối Ưu Hóa:**
   - Phân công tự động: Cân bằng tải giữa các giáo viên
   - Tạo lịch thi tự động: Phân bổ đều trong khoảng thời gian kỳ thi

---

## 📝 Kết Luận

Cả hai chức năng tự động hóa đều sử dụng các thuật toán thông minh để:
- ✅ Tuân thủ các ràng buộc nghiệp vụ
- ✅ Cân bằng tải và phân bổ công bằng
- ✅ Tối ưu hóa việc sử dụng tài nguyên
- ✅ Giảm thiểu công việc thủ công cho admin

Việc hiểu rõ logic của cả hai chức năng sẽ giúp:
- Sử dụng hiệu quả hơn
- Debug khi gặp vấn đề
- Tối ưu hóa cấu hình để đạt kết quả tốt nhất


// import { Subject, ClassType, TeachingAssignment } from "@/types/class";
// import { ClassSchedule, TimetableEntry, ScheduleConfig, SubjectHour,ActivitySlot } from "@/types/schedule";
// import { Activity } from "@/types/class";

// export type Grade = "10" | "11" | "12";

// function isTeacherAvailable(assignment: TeachingAssignment | undefined, dayIdx: number, periodIdx: number): boolean {
//   if (!assignment || !assignment.teacherId) return true;
//   const teacher = assignment.teacherId as any;
//   return teacher.availableMatrix?.[dayIdx]?.[periodIdx] ?? true;
// }

// function occupyTeacherSlot(assignment: TeachingAssignment | undefined, dayIdx: number, periodIdx: number) {
//   if (!assignment || !assignment.teacherId) return;
//   const teacher = assignment.teacherId as any;
//   if (teacher.availableMatrix?.[dayIdx]) teacher.availableMatrix[dayIdx][periodIdx] = false;
// }

// /** 🔹 Helper: random int trong khoảng */
// function getRandomInt(min: number, max: number): number {
//   return Math.floor(Math.random() * (max - min + 1)) + min;
// }

// /** 🔹 Lấy danh sách ngày */
// function getDaysFromConfig(config: ScheduleConfig): string[] {
//   return Object.keys(config.days);
// }

// /** 🔹 Số tiết / buổi */
// function getPeriodsPerDay(config: ScheduleConfig, session: "morning" | "afternoon"): number {
//   const anyDay = Object.values(config.days)[0];
//   return session === "morning" ? anyDay.morningPeriods : anyDay.afternoonPeriods;
// }

// /** 🔹 Kiểm tra không lặp môn liên tiếp */
// function isValidPlacement(timetable: TimetableEntry[], dayIndex: number, periodIndex: number, subject: string): boolean {
//   const day = timetable[dayIndex];
//   if (periodIndex > 0 && day.periods[periodIndex - 1].subject === subject) return false;
//   if (periodIndex < day.periods.length - 1 && day.periods[periodIndex + 1].subject === subject) return false;
//   return true;
// }

// /** 🔹 Kiểm tra xung đột giáo viên với các lớp khác */
// function hasTeacherConflict(newSchedule: TimetableEntry[], allSchedules: ClassSchedule[], assignments: TeachingAssignment[], classId: string): boolean {
//   for (let dayIdx = 0; dayIdx < newSchedule.length; dayIdx++) {
//     for (let periodIdx = 0; periodIdx < newSchedule[dayIdx].periods.length; periodIdx++) {
//       const period = newSchedule[dayIdx].periods[periodIdx];
//       if (!period.subject || !period.teacher) continue;

//       for (const otherSchedule of allSchedules) {
//         if (otherSchedule.classId === classId) continue;
//         const otherPeriod = otherSchedule.timetable[dayIdx]?.periods[periodIdx];
//         if (!otherPeriod?.subject || !otherPeriod.teacher) continue;
//         if (otherPeriod.teacher === period.teacher) return true;
//       }
//     }
//   }
//   return false;
// }

// /** 🔹 Hàm kiểm tra môn có phù hợp với khối không */
// function isSubjectForGrade(subjectName: string, subjects: Subject[], grade: Grade): boolean {
//   const subject = subjects.find(s => s.name === subjectName);
//   return subject ? subject.grades.includes(grade) : false;
// }

// function generateScheduleForClass(
//   config: ScheduleConfig,
//   grade: Grade,
//   classId: string,
//   assignments: TeachingAssignment[],
//   allSchedules: ClassSchedule[],
//   subjects: Subject[],
//   isMainSessionMorning: boolean,
//   teacherAvailabilityMap: Record<string, boolean[][]>
// ): TimetableEntry[] {
//   const DAYS = getDaysFromConfig(config);
//   const morningPeriods = getPeriodsPerDay(config, "morning");
//   const afternoonPeriods = getPeriodsPerDay(config, "afternoon");
//   const totalPeriods = morningPeriods + afternoonPeriods;

//   // Khởi tạo bảng trống - thêm field locked
//   const timetable: TimetableEntry[] = DAYS.map(day => ({
//     day,
//     periods: Array.from({ length: totalPeriods }, (_, i) => ({
//       period: i + 1,
//       subject: "",
//       teacher: "",
//       locked: false, // new flag
//     } as any)),
//   }));

//   const mainStart = isMainSessionMorning ? 0 : morningPeriods;
//   const mainEnd = isMainSessionMorning ? morningPeriods : totalPeriods;
//   const extraStart = isMainSessionMorning ? morningPeriods : 0;
//   const extraEnd = isMainSessionMorning ? totalPeriods : morningPeriods;

//   // ----- Chèn hoạt động cố định trước (khóa slot) -----
//   config.activities.forEach(act => {
//     if (!act.activityId) return;
//     const activity = act.activityId as Activity;
//     if (!activity.dayOfWeek || !activity.timeSlot) return;
//     const dayIdx = DAYS.findIndex(d => d.toLowerCase() === activity.dayOfWeek!.toLowerCase().slice(0, 3));
//     if (dayIdx < 0) return;
//     const periodIdx = Number(activity.timeSlot) - 1;
//     const slot = timetable[dayIdx].periods[periodIdx] as any;
//     if (!slot.subject) {
//       slot.subject = activity.name;
//       slot.teacher = "";
//       slot.locked = true; // khóa để môn không thể ghi đè
//     }
//   });

//   // Helper -> lấy assignment cho môn của lớp này (an toàn)
//   function findAssignmentFor(itemName: string) {
//     return assignments.find(a => {
//       const classMatch = (a.classId && ((a.classId as any)._id ? (a.classId as any)._id.toString() : a.classId.toString())) === classId;
//       const subjectName = (a.subjectId && (a.subjectId as any).name) || "";
//       const subjectIdStr = (a.subjectId && ((a.subjectId as any)._id ? (a.subjectId as any)._id.toString() : a.subjectId.toString())) || "";
//       return classMatch && (subjectName === itemName || subjectIdStr === itemName);
//     });
//   }

//   // Helper kiểm tra availability (dùng teacherAvailabilityMap)
//   function isTeacherAvailableById(teacherId: any, dayIdx: number, periodIdx: number): boolean {
//     if (!teacherId) return true;
//     const tid = (teacherId._id || teacherId).toString();
//     const mat = teacherAvailabilityMap[tid];
//     if (!mat) return true;
//     return !!mat[dayIdx]?.[periodIdx];
//   }

//   function occupyTeacherById(teacherId: any, dayIdx: number, periodIdx: number) {
//     if (!teacherId) return;
//     const tid = (teacherId._id || teacherId).toString();
//     if (!teacherAvailabilityMap[tid]) {
//       // nếu chưa có thì khởi tạo theo cấu hình
//       teacherAvailabilityMap[tid] = Array.from({ length: DAYS.length }, () => Array(totalPeriods).fill(true));
//     }
//     teacherAvailabilityMap[tid][dayIdx][periodIdx] = false;
//   }

//   // Sửa isValidPlacement để tôn trọng slot.locked (và coi activity là khác môn)
//   function isValidPlacementLocal(timetableLocal: TimetableEntry[], dayIndex: number, periodIndex: number, subject: string): boolean {
//     const day = timetableLocal[dayIndex];
//     const prev = day.periods[periodIndex - 1];
//     const next = day.periods[periodIndex + 1];
//     // Nếu tiết trước cùng môn và tiết đó không phải là activity -> invalid
//     if (prev && (prev as any).subject === subject && !(prev as any).locked) return false;
//     if (next && (next as any).subject === subject && !(next as any).locked) return false;
//     return true;
//   }

//   // scheduleItems dùng các helper trên
//   function scheduleItems(items: { name: string; periodsPerWeek: number; maxPeriodsPerDay: number; allowConsecutive: boolean; session: "main" | "extra"; isSubject: boolean }[], start: number, end: number) {
//     for (const item of items) {
//       let placedCount = timetable.flatMap(day => day.periods).filter((p: any) => p.subject === item.name).length;

//       let attempt = 0;
//       const maxAttempts = 500;
//       while (placedCount < item.periodsPerWeek && attempt < maxAttempts) {
//         attempt++;
//         const dayIdx = getRandomInt(0, DAYS.length - 1);
//         const periodIdx = getRandomInt(start, end - 1);
//         const slot:any = timetable[dayIdx].periods[periodIdx];
//         const periodsInSession = timetable[dayIdx].periods.slice(start, end).filter(p => p.subject === item.name).length;
//         const assignment = item.isSubject ? findAssignmentFor(item.name) : undefined;

//         if (periodsInSession >= item.maxPeriodsPerDay) continue;

//         if (
//           !slot.subject &&
//           !slot.locked &&
//           isValidPlacementLocal(timetable, dayIdx, periodIdx, item.name) &&
//           (!item.isSubject || isTeacherAvailableById(assignment?.teacherId, dayIdx, periodIdx))
//         ) {
//           slot.subject = item.name;
//           slot.teacher = item.isSubject ? ((assignment?.teacherId && (assignment.teacherId as any).name) || "") : "";
//           if (item.isSubject && assignment?.teacherId) occupyTeacherById(assignment.teacherId, dayIdx, periodIdx);
//           placedCount++;

//           // Double tiết
//           if (item.allowConsecutive && placedCount < item.periodsPerWeek && Math.random() < 0.8 && periodIdx + 1 < end) {
//             const next = timetable[dayIdx].periods[periodIdx + 1] as any;
//             if (!next.subject && !next.locked && (!item.isSubject || isTeacherAvailableById(assignment?.teacherId, dayIdx, periodIdx + 1))) {
//               next.subject = item.name;
//               next.teacher = slot.teacher;
//               if (item.isSubject && assignment?.teacherId) occupyTeacherById(assignment.teacherId, dayIdx, periodIdx + 1);
//               placedCount++;
//             }
//           }
//         }
//       }
//     }
//   }

//   // --- tạo danh sách mainSubjects/mainActivities/extras giống code cũ ---
//   const mainSubjects = Object.keys(config.subjectHours)
//     .filter(name => config.subjectHours[name].session === "main" && isSubjectForGrade(name, subjects, grade))
//     .map(name => ({
//       name,
//       periodsPerWeek: config.subjectHours[name].periodsPerWeek,
//       maxPeriodsPerDay: config.subjectHours[name].maxPeriodsPerDay,
//       allowConsecutive: config.subjectHours[name].allowConsecutive,
//       session: "main" as const,
//       isSubject: true,
//     }));

//   const mainActivities = config.activities
//     .filter(act => act.session === "main")
//     .map(act => {
//       const activity = act.activityId as Activity;
//       return {
//         name: activity.name,
//         periodsPerWeek: act.periodsPerWeek,
//         maxPeriodsPerDay: 1,
//         allowConsecutive: false,
//         session: "main" as const,
//         isSubject: false,
//       };
//     });

//   scheduleItems([...mainSubjects, ...mainActivities], mainStart, mainEnd);

//   const extraSubjects = Object.keys(config.subjectHours)
//     .filter(name => config.subjectHours[name].session === "extra" && isSubjectForGrade(name, subjects, grade))
//     .map(name => ({
//       name,
//       periodsPerWeek: config.subjectHours[name].periodsPerWeek,
//       maxPeriodsPerDay: config.subjectHours[name].maxPeriodsPerDay,
//       allowConsecutive: config.subjectHours[name].allowConsecutive,
//       session: "extra" as const,
//       isSubject: true,
//     }));

//   const extraActivities = config.activities
//     .filter(act => act.session === "extra")
//     .map(act => {
//       const activity = act.activityId as Activity;
//       return {
//         name: activity.name,
//         periodsPerWeek: act.periodsPerWeek,
//         maxPeriodsPerDay: 1,
//         allowConsecutive: false,
//         session: "extra" as const,
//         isSubject: false,
//       };
//     });

//   scheduleItems([...extraSubjects, ...extraActivities], extraStart, extraEnd);

//   // cố gắng xếp thêm như cũ (sử dụng teacherAvailabilityMap khi cần)
//   const allItems = [...mainSubjects, ...mainActivities, ...extraSubjects, ...extraActivities];
//   for (const item of allItems) {
//     let placedCount = timetable.flatMap(day => day.periods).filter((p: any) => p.subject === item.name).length;
//     const start = item.session === "main" ? mainStart : extraStart;
//     const end = item.session === "main" ? mainEnd : extraEnd;

//     let attempt = 0;
//     const maxAttempts = 200;
//     while (placedCount < item.periodsPerWeek && attempt < maxAttempts) {
//       attempt++;
//       const dayIdx = getRandomInt(0, DAYS.length - 1);
//       const periodIdx = getRandomInt(start, end - 1);
//       const slot:any = timetable[dayIdx].periods[periodIdx];
//       const periodsInSession = timetable[dayIdx].periods.slice(start, end).filter(p => p.subject === item.name).length;
//       const assignment = item.isSubject ? findAssignmentFor(item.name) : undefined;

//       if (periodsInSession >= item.maxPeriodsPerDay) continue;

//       if (
//         !slot.subject &&
//         !slot.locked &&
//         isValidPlacementLocal(timetable, dayIdx, periodIdx, item.name) &&
//         (!item.isSubject || isTeacherAvailableById(assignment?.teacherId, dayIdx, periodIdx))
//       ) {
//         slot.subject = item.name;
//         slot.teacher = item.isSubject ? ((assignment?.teacherId && (assignment.teacherId as any).name) || "") : "";
//         if (item.isSubject && assignment?.teacherId) occupyTeacherById(assignment.teacherId, dayIdx, periodIdx);
//         placedCount++;

//         if (item.allowConsecutive && placedCount < item.periodsPerWeek && Math.random() < 0.8 && periodIdx + 1 < end) {
//           const next = timetable[dayIdx].periods[periodIdx + 1] as any;
//           if (!next.subject && !next.locked && (!item.isSubject || isTeacherAvailableById(assignment?.teacherId, dayIdx, periodIdx + 1))) {
//             next.subject = item.name;
//             next.teacher = slot.teacher;
//             if (item.isSubject && assignment?.teacherId) occupyTeacherById(assignment.teacherId, dayIdx, periodIdx + 1);
//             placedCount++;
//           }
//         }
//       }
//     }
//   }

//   // cảnh báo nếu thiếu tiết
//   for (const item of allItems) {
//     const placedCount = timetable.flatMap(day => day.periods).filter((p: any) => p.subject === item.name).length;
//     if (placedCount !== item.periodsPerWeek) {
//       console.warn(`Lớp ${classId} (khối ${grade}): Môn/Hoạt động "${item.name}" xếp được ${placedCount}/${item.periodsPerWeek} tiết.`);
//     }
//   }

//   return timetable;
// }



// /** 🔹 Sinh toàn bộ lịch cho các lớp */
// export function autoGenerateSchedule(
//   config: ScheduleConfig,
//   subjects: Subject[],
//   classes: ClassType[],
//   assignments: TeachingAssignment[],
//   year: string,
//   semester: string
// ): ClassSchedule[] {
//   const allSchedules: ClassSchedule[] = [];

//   // ✅ Lọc phân công đúng năm + học kỳ chỉ 1 lần
//   const filteredAssignments = assignments.filter(a => a.year === year && a.semester === semester);

//   // ✅ Chuẩn bị bản sao availability của từng GV
//   const teacherAvailabilityMap: Record<string, boolean[][]> = {};
//   for (const a of filteredAssignments) {
//     const teacher = (a.teacherId as any) || {};
//     const teacherIdStr = (teacher._id || teacher).toString();

//     teacherAvailabilityMap[teacherIdStr] = Array.from(
//       { length: Object.keys(config.days).length },
//       (_, i) =>
//         (teacher.availableMatrix?.[i]?.length
//           ? [...teacher.availableMatrix[i]]
//           : Array(
//               getPeriodsPerDay(config, "morning") +
//               getPeriodsPerDay(config, "afternoon")
//             ).fill(true))
//     );
//   }

//   // ✅ Lặp qua từng lớp
//   for (const cls of classes) {
//     const gradeRule = config.gradeSessionRules.find(g => g.grade === cls.grade);
//     const isMainSessionMorning = gradeRule?.session === "morning";

//     let timetable = generateScheduleForClass(
//       config,
//       cls.grade as Grade,
//       cls._id || "",
//       filteredAssignments,
//       allSchedules,
//       subjects,
//       isMainSessionMorning,
//       teacherAvailabilityMap
//     );

//     // ✅ Kiểm tra và xử lý xung đột GV giữa các lớp
//     let conflictAttempts = 0;
//     const maxAttempts = 10;
//     while (hasTeacherConflict(timetable, allSchedules, filteredAssignments, cls._id || "") && conflictAttempts < maxAttempts) {
//       conflictAttempts++;
//       timetable = generateScheduleForClass(
//         config,
//         cls.grade as Grade,
//         cls._id || "",
//         filteredAssignments,
//         allSchedules,
//         subjects,
//         isMainSessionMorning,
//         teacherAvailabilityMap // ✅ Bổ sung lại
//       );
//     }

//     if (conflictAttempts > 0)
//       console.warn(`⚠️ Lớp ${cls.className}: đã tạo lại ${conflictAttempts} lần do xung đột GV.`);

//     allSchedules.push({
//       classId: cls._id || "",
//       className: cls.className,
//       year,
//       semester,
//       timetable,
//     });
//   }

//   return allSchedules;
// }
import { Subject, ClassType, TeachingAssignment } from "@/types/class";
import { ClassSchedule, TimetableEntry, ScheduleConfig } from "@/types/schedule";
import { Activity } from "@/types/class";

export type Grade = "10" | "11" | "12";

function isTeacherAvailable(assignment: TeachingAssignment | undefined, dayIdx: number, periodIdx: number): boolean {
  if (!assignment || !assignment.teacherId) return true;
  const teacher = assignment.teacherId as any;
  return teacher.availableMatrix?.[dayIdx]?.[periodIdx] ?? true;
}

function occupyTeacherSlot(assignment: TeachingAssignment | undefined, dayIdx: number, periodIdx: number) {
  if (!assignment || !assignment.teacherId) return;
  const teacher = assignment.teacherId as any;
  if (teacher.availableMatrix?.[dayIdx]) teacher.availableMatrix[dayIdx][periodIdx] = false;
}

/** 🔹 Helper: random int trong khoảng */
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 🔹 Lấy danh sách ngày */
function getDaysFromConfig(config: ScheduleConfig): string[] {
  return Object.keys(config.days);
}

/** 🔹 Số tiết / buổi */
function getPeriodsPerDay(config: ScheduleConfig, session: "morning" | "afternoon"): number {
  const anyDay = Object.values(config.days)[0];
  return session === "morning" ? anyDay.morningPeriods : anyDay.afternoonPeriods;
}

/** 🔹 Kiểm tra không lặp môn liên tiếp */
function isValidPlacement(timetable: TimetableEntry[], dayIndex: number, periodIndex: number, subject: string): boolean {
  const day = timetable[dayIndex];
  if (periodIndex > 0 && day.periods[periodIndex - 1].subject === subject) return false;
  if (periodIndex < day.periods.length - 1 && day.periods[periodIndex + 1].subject === subject) return false;
  return true;
}

/** 🔹 Kiểm tra xung đột giáo viên với các lớp khác */
function hasTeacherConflict(newSchedule: TimetableEntry[], allSchedules: ClassSchedule[], assignments: TeachingAssignment[], classId: string): boolean {
  for (let dayIdx = 0; dayIdx < newSchedule.length; dayIdx++) {
    for (let periodIdx = 0; periodIdx < newSchedule[dayIdx].periods.length; periodIdx++) {
      const period = newSchedule[dayIdx].periods[periodIdx];
      if (!period.subject || !period.teacher) continue;

      for (const otherSchedule of allSchedules) {
        if (otherSchedule.classId === classId) continue;
        const otherPeriod = otherSchedule.timetable[dayIdx]?.periods[periodIdx];
        if (!otherPeriod?.subject || !otherPeriod.teacher) continue;
        if (otherPeriod.teacher === period.teacher) return true;
      }
    }
  }
  return false;
}

/** 🔹 Hàm kiểm tra môn có phù hợp với khối không */
function isSubjectForGrade(subjectName: string, subjects: Subject[], grade: Grade): boolean {
  const subject = subjects.find(s => s.name === subjectName);
  return subject ? subject.grades.includes(grade) : false;
}

/** 🔹 Sinh TKB cho từng lớp */
function generateScheduleForClass(
  config: ScheduleConfig,
  grade: Grade,
  classId: string,
  assignments: TeachingAssignment[],
  allSchedules: ClassSchedule[],
  subjects: Subject[],
  isMainSessionMorning: boolean,
  teacherAvailabilityMap: Record<string, boolean[][]>
): TimetableEntry[] {
  const DAYS = getDaysFromConfig(config);
  const morningPeriods = getPeriodsPerDay(config, "morning");
  const afternoonPeriods = getPeriodsPerDay(config, "afternoon");
  const totalPeriods = morningPeriods + afternoonPeriods;

  // 🔸 Khởi tạo bảng trống có flag locked
  const timetable: TimetableEntry[] = DAYS.map(day => ({
    day,
    periods: Array.from({ length: totalPeriods }, (_, i) => ({
      period: i + 1,
      subject: "",
      teacher: "",
      locked: false,
    } as any)),
  }));

  const mainStart = isMainSessionMorning ? 0 : morningPeriods;
  const mainEnd = isMainSessionMorning ? morningPeriods : totalPeriods;
  const extraStart = isMainSessionMorning ? morningPeriods : 0;
  const extraEnd = isMainSessionMorning ? totalPeriods : morningPeriods;

  // 🔹 Bước 1: Chèn các hoạt động cố định trước (lock slot)
  config.activities.forEach(act => {
    if (!act.activityId) return;
    const activity = act.activityId as Activity;
    if (!activity.dayOfWeek || !activity.timeSlot) return;

    // Chuẩn hóa tên ngày
    const dayIdx = DAYS.findIndex(
      d => d.toLowerCase().slice(0, 3) === activity.dayOfWeek!.toLowerCase().slice(0, 3)
    );
    if (dayIdx < 0) return;

    const periodIdx = Number(activity.timeSlot) - 1;
    const slot = timetable[dayIdx].periods[periodIdx] as any;
    if (!slot.subject) {
      slot.subject = activity.name;
      slot.teacher = "";
      slot.locked = true; // khóa lại
    }
  });

  // Helper: tìm phân công
  function findAssignmentFor(itemName: string) {
    return assignments.find(a => {
      const classMatch =
        (a.classId && ((a.classId as any)._id ? (a.classId as any)._id.toString() : a.classId.toString())) === classId;
      const subjectName = (a.subjectId && (a.subjectId as any).name) || "";
      const subjectIdStr =
        (a.subjectId && ((a.subjectId as any)._id ? (a.subjectId as any)._id.toString() : a.subjectId.toString())) || "";
      return classMatch && (subjectName === itemName || subjectIdStr === itemName);
    });
  }

  // Helper kiểm tra/ghi occupancy giáo viên
  function isTeacherAvailableById(teacherId: any, dayIdx: number, periodIdx: number): boolean {
    if (!teacherId) return true;
    const tid = (teacherId._id || teacherId).toString();
    const mat = teacherAvailabilityMap[tid];
    if (!mat) return true;
    return !!mat[dayIdx]?.[periodIdx];
  }

  function occupyTeacherById(teacherId: any, dayIdx: number, periodIdx: number) {
    if (!teacherId) return;
    const tid = (teacherId._id || teacherId).toString();
    if (!teacherAvailabilityMap[tid]) {
      teacherAvailabilityMap[tid] = Array.from({ length: DAYS.length }, () =>
        Array(totalPeriods).fill(true)
      );
    }
    teacherAvailabilityMap[tid][dayIdx][periodIdx] = false;
  }

  // Kiểm tra hợp lệ (tránh trùng & tôn trọng locked)
  function isValidPlacementLocal(timetableLocal: TimetableEntry[], dayIndex: number, periodIndex: number, subject: string): boolean {
    const day = timetableLocal[dayIndex];
    const prev = day.periods[periodIndex - 1];
    const next = day.periods[periodIndex + 1];
    if (prev && (prev as any).subject === subject && !(prev as any).locked) return false;
    if (next && (next as any).subject === subject && !(next as any).locked) return false;
    return true;
  }

  // 🔸 Hàm xếp môn/hoạt động
  function scheduleItems(
    items: { name: string; periodsPerWeek: number; maxPeriodsPerDay: number; allowConsecutive: boolean; session: "main" | "extra"; isSubject: boolean }[],
    start: number,
    end: number
  ) {
    for (const item of items) {
      let placedCount = timetable.flatMap(day => day.periods).filter((p: any) => p.subject === item.name).length;
      let attempt = 0;
      const maxAttempts = 500;

      while (placedCount < item.periodsPerWeek && attempt < maxAttempts) {
        attempt++;
        const dayIdx = getRandomInt(0, DAYS.length - 1);
        const periodIdx = getRandomInt(start, end - 1);
        const slot: any = timetable[dayIdx].periods[periodIdx];
        const periodsInSession = timetable[dayIdx].periods.slice(start, end).filter(p => p.subject === item.name).length;
        const assignment = item.isSubject ? findAssignmentFor(item.name) : undefined;

        if (periodsInSession >= item.maxPeriodsPerDay) continue;

        if (
          !slot.subject &&
          !slot.locked &&
          isValidPlacementLocal(timetable, dayIdx, periodIdx, item.name) &&
          (!item.isSubject || isTeacherAvailableById(assignment?.teacherId, dayIdx, periodIdx))
        ) {
          slot.subject = item.name;
          slot.teacher = item.isSubject ? ((assignment?.teacherId && (assignment.teacherId as any).name) || "") : "";
          if (item.isSubject && assignment?.teacherId) occupyTeacherById(assignment.teacherId, dayIdx, periodIdx);
          placedCount++;

          // Double tiết
          if (item.allowConsecutive && placedCount < item.periodsPerWeek && Math.random() < 0.8 && periodIdx + 1 < end) {
            const next = timetable[dayIdx].periods[periodIdx + 1] as any;
            if (!next.subject && !next.locked && (!item.isSubject || isTeacherAvailableById(assignment?.teacherId, dayIdx, periodIdx + 1))) {
              next.subject = item.name;
              next.teacher = slot.teacher;
              if (item.isSubject && assignment?.teacherId) occupyTeacherById(assignment.teacherId, dayIdx, periodIdx + 1);
              placedCount++;
            }
          }
        }
      }
    }
  }

  // 🔹 Chuẩn bị danh sách các item cần xếp
  const mainSubjects = Object.keys(config.subjectHours)
    .filter(name => config.subjectHours[name].session === "main" && isSubjectForGrade(name, subjects, grade))
    .map(name => ({
      name,
      periodsPerWeek: config.subjectHours[name].periodsPerWeek,
      maxPeriodsPerDay: config.subjectHours[name].maxPeriodsPerDay,
      allowConsecutive: config.subjectHours[name].allowConsecutive,
      session: "main" as const,
      isSubject: true,
    }));

  const mainActivities = config.activities
    .filter(act => act.session === "main")
    .map(act => {
      const activity = act.activityId as Activity;
      return {
        name: activity.name,
        periodsPerWeek: act.periodsPerWeek,
        maxPeriodsPerDay: 1,
        allowConsecutive: false,
        session: "main" as const,
        isSubject: false,
      };
    });

  scheduleItems([...mainSubjects, ...mainActivities], mainStart, mainEnd);

  const extraSubjects = Object.keys(config.subjectHours)
    .filter(name => config.subjectHours[name].session === "extra" && isSubjectForGrade(name, subjects, grade))
    .map(name => ({
      name,
      periodsPerWeek: config.subjectHours[name].periodsPerWeek,
      maxPeriodsPerDay: config.subjectHours[name].maxPeriodsPerDay,
      allowConsecutive: config.subjectHours[name].allowConsecutive,
      session: "extra" as const,
      isSubject: true,
    }));

  const extraActivities = config.activities
    .filter(act => act.session === "extra")
    .map(act => {
      const activity = act.activityId as Activity;
      return {
        name: activity.name,
        periodsPerWeek: act.periodsPerWeek,
        maxPeriodsPerDay: 1,
        allowConsecutive: false,
        session: "extra" as const,
        isSubject: false,
      };
    });

  scheduleItems([...extraSubjects, ...extraActivities], extraStart, extraEnd);

  // 🔸 Kiểm tra thiếu tiết
  const allItems = [...mainSubjects, ...mainActivities, ...extraSubjects, ...extraActivities];
  for (const item of allItems) {
    const placedCount = timetable.flatMap(day => day.periods).filter((p: any) => p.subject === item.name).length;
    if (placedCount !== item.periodsPerWeek) {
      console.warn(`Lớp ${classId} (khối ${grade}): Môn/Hoạt động "${item.name}" xếp được ${placedCount}/${item.periodsPerWeek} tiết.`);
    }
  }

  return timetable;
}

/** 🔹 Sinh toàn bộ lịch cho các lớp */
export function autoGenerateSchedule(
  config: ScheduleConfig,
  subjects: Subject[],
  classes: ClassType[],
  assignments: TeachingAssignment[],
  year: string,
  semester: string
): ClassSchedule[] {
  const allSchedules: ClassSchedule[] = [];

  const filteredAssignments = assignments.filter(a => a.year === year && a.semester === semester);

  // Chuẩn bị map availability GV
  const teacherAvailabilityMap: Record<string, boolean[][]> = {};
  for (const a of filteredAssignments) {
    const teacher = (a.teacherId as any) || {};
    const teacherIdStr = (teacher._id || teacher).toString();
    teacherAvailabilityMap[teacherIdStr] = Array.from(
      { length: Object.keys(config.days).length },
      (_, i) =>
        (teacher.availableMatrix?.[i]?.length
          ? [...teacher.availableMatrix[i]]
          : Array(getPeriodsPerDay(config, "morning") + getPeriodsPerDay(config, "afternoon")).fill(true))
    );
  }

  // Lặp qua từng lớp
  for (const cls of classes) {
    const gradeRule = config.gradeSessionRules.find(g => g.grade === cls.grade);
    const isMainSessionMorning = gradeRule?.session === "morning";

    let timetable = generateScheduleForClass(
      config,
      cls.grade as Grade,
      cls._id || "",
      filteredAssignments,
      allSchedules,
      subjects,
      isMainSessionMorning,
      teacherAvailabilityMap
    );

    let conflictAttempts = 0;
    const maxAttempts = 10;
    while (hasTeacherConflict(timetable, allSchedules, filteredAssignments, cls._id || "") && conflictAttempts < maxAttempts) {
      conflictAttempts++;
      timetable = generateScheduleForClass(
        config,
        cls.grade as Grade,
        cls._id || "",
        filteredAssignments,
        allSchedules,
        subjects,
        isMainSessionMorning,
        teacherAvailabilityMap
      );
    }

    if (conflictAttempts > 0)
      console.warn(`⚠️ Lớp ${cls.className}: đã tạo lại ${conflictAttempts} lần do xung đột GV.`);

    allSchedules.push({
      classId: cls._id || "",
      className: cls.className,
      year,
      semester,
      timetable,
    });
  }

  return allSchedules;
}

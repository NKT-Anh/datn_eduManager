import { Activity } from "./class";
export interface PeriodEntry {
  period: number;
  subject: string; 
  teacher: string;  
}
export interface TimetableEntry{
    day: string;
    periods: PeriodEntry[];
}

export interface ClassSchedule {
    // _id?: string;
    classId: string;
    className?: string;
    year: string; // "2023-2024"
    timetable: TimetableEntry[];
    semester: string;
}
export interface SchedulePayload{
    classId: string;
    timetable: TimetableEntry[];
    year: string;
    semester: string;
    updatedAt?: string;
}
// export interface GradeSessionRule {
//   grade: "10" | "11" | "12";          // Khối
//   session: "morning" | "afternoon" | "both"; // Buổi học chính
// }

// export interface GradeConfig {
//   session: "morning" | "afternoon" | "both" | "secondary" | "primary";
//   periodsPerWeek: number;
//   maxPeriodsPerDay: number;
//   allowConsecutive: boolean;
// }

// export interface SubjectSessionRule {
//   subjectId: string;          // ID môn học (liên kết tới Subject)
//   subjectName: string;        // Tên môn học
//   // gradeConfigs: Record<string, GradeConfig>; 
//   grade: "10" | "11" | "12";
//   // Key là mã khối, ví dụ "6", "7", "8", "9"
// }


// // export interface ScheduleConfig{
// //   periodsPerDay : number;  // Tổng số tiết / ngày (VD: 7)
// //   minutesPerPeriod : number; // thời gian 1 tiết
// //   defaultBreakMinutes: number // nghỉ giữa tiết
// //   breaksBetweenPeriods : Record<number,number> ; // ra chơi
// //   morningStartTime : string;
// //   afternoonStartTime : string;
// //   subjectHours: Record<string, number>; // Số tiết / tuần cho từng môn 

// // }
// export interface DailySchedule {
//   totalPeriods: number;       // Tổng số tiết trong ngày (VD: 7)
//   morningPeriods: number;     // Số tiết buổi sáng
//   afternoonPeriods?: number;  // Tự tính = totalPeriods - morningPeriods
// }
// export interface ActivitySlot {
//   activityId: string;                 // ObjectId của Activity
//   period: number;                     // Tiết diễn ra
//   session: "morning" | "afternoon";   // Buổi
// }

// export interface ScheduleConfig {
//   // --- Cấu hình chung ---
//   defaultStartTimeMorning: string;   // "07:00"
//   defaultStartTimeAfternoon: string; // "13:00"
//   minutesPerPeriod: number;          // 45 phút / tiết
//   defaultBreakMinutes: number;       // nghỉ giữa tiết (ngắn)
//     activities: ActivitySlot[];
//   // Map dạng { "2": 30 } tức là sau tiết 2 thì nghỉ 30 phút
//   specialBreaks: {
//   period: number;        // Tiết áp dụng
//   session: "morning" | "afternoon";  // Buổi
//   minutes: number;       // Thời gian nghỉ
//   }[]


//   // --- Cấu hình từng ngày ---
//   days: Record<string, DailySchedule>; // key = "2"..."7"
//     // --- Cấu hình buổi học chính cho từng khối ---
//   gradeSessionRules: GradeSessionRule[];

//   // --- Cấu hình buổi học cho từng môn ---
//   subjectSessionRules: SubjectSessionRule[];
//   // --- Số tiết / tuần cho từng môn ---
//   subjectHours: Record<string, number>; // { "Toán": 4, "Văn": 3 }

//   // --- Môn học đặc thù học buổi chiều ---
//   specialSubjects: string[]; // ["GDTC"]

//   createdAt?: string;
//   updatedAt?: string;
//   _id?: string;
// }

export interface DailySchedule {
  totalPeriods: number;       // Tổng số tiết trong ngày
  morningPeriods: number;     // Số tiết buổi sáng
  afternoonPeriods?: number;  // Tự tính = total - morning
}

export interface ActivitySlot {
  activityId: string | Activity;          // ObjectId của Activity
  periodsPerWeek: number;                
   session: "main" | "extra";// Buổi
}
export interface GradeSessionRule {
  grade: "10" | "11" | "12"; // Khối
  session: "morning" | "afternoon" | "both"; // Buổi học chính
}
export interface SubjectHour {
  periodsPerWeek: number;    // Số tiết / tuần
  maxPeriodsPerDay: number;  // Tối đa tiết / ngày
  allowConsecutive: boolean; // Cho phép tiết liên tiếp
  session: "main" | "extra"; // Buổi chính / phụ
}

export interface ScheduleConfig {
  // --- Cấu hình chung ---
  defaultStartTimeMorning: string;   // "07:00"
  defaultStartTimeAfternoon: string; // "13:00"
  minutesPerPeriod: number;          // 45 phút / tiết
  defaultBreakMinutes: number;       // Nghỉ giữa tiết (ngắn)
  activities: ActivitySlot[];        // Các slot hoạt động đặc biệt
  
  specialBreaks: {
    period: number;                  // Tiết áp dụng
    session: "morning" | "afternoon";
    minutes: number;                 // Thời gian nghỉ
  }[];

  // --- Cấu hình theo ngày ---
  days: Record<string, DailySchedule>; // key = "2"..."7"
 gradeSessionRules: GradeSessionRule[];
  // --- Số tiết / tuần & config cho từng môn ---
  subjectHours: Record<string, SubjectHour>; // VD: { "Toán": {...}, "Văn": {...} }

  // --- Môn học đặc thù học buổi chiều ---

  createdAt?: string;
  updatedAt?: string;
  _id?: string;
}

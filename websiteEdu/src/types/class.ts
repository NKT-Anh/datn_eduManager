import { Student } from './auth';

import { Teacher } from './auth';
export interface Grade {
  _id?: string;
  name: string;                // Ví dụ: "Khối 10"              // Mã nội bộ, vd: "G10"
  level: 'primary' | 'secondary' | 'high'; // Cấp học: tiểu học, THCS, THPT
  description?: string;        // Ghi chú thêm
  createdAt?: string;
  updatedAt?: string;
}

// 🔹 Dữ liệu gửi khi tạo hoặc cập nhật khối
export interface GradeInput {
  name: string;
  level: 'primary' | 'secondary' | 'high';
  description?: string;
}

export interface ClassType {
  _id: string;
  classCode: string;
  className: string;
  grade: '10' | '11' | '12';
  capacity: number;
  currentSize?: number;
  teacherId?: Teacher | null;
  students?: Array<Pick<Student, '_id' | 'name' | 'studentCode'>>;
  year?: string;
    roomId?: {
    _id: string;
    roomCode: string;
    name?: string;
    capacity?: number;
    type?: "normal" | "lab" | "computer";
    status?: "available" | "maintenance" | "inactive";
  } | null;

  
  createdAt?: string;
  updatedAt?: string;
}


export interface Subject {
  _id: string; // MongoDB sẽ trả về _id
  name: string;
  code?: string;
  grades: Array<'10' | '11' | '12'>;
  description?: string;
  createdAt?: string; // ISO string từ backend
  includeInAverage?: boolean; // Mặc định true
  defaultExamDuration?: number; // 🕒 thời lượng thi mặc định
  isActive?: boolean; // ✅ Trạng thái hoạt động (mặc định true)
  departmentId?: {
    _id: string;
    name: string;
    code: string;
  } | string | null; // Tổ bộ môn
}

// Data gửi khi tạo mới hoặc update
export interface SubjectInput {
  name: string;
  code?: string;
  grade: '10' | '11' | '12';
  description?: string;
}

export interface TeachingAssignment {
  _id: string;
  teacherId: {
    _id: string;
    name: string;
  };
  subjectId: {
    _id: string;
    name: string;
  };
  classId: {
    _id: string;
    className: string;
    classCode: string;
    grade: '10' | '11' | '12';
    year: string;
  };
  year: string;
  semester: '1' | '2';
  isPublished?: boolean;
  publishedAt?: string;
  publishedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}


export interface TeachingAssignmentPayload {
  teacherId: string;
  subjectId: string;
  classId: string;
  year: string;
  semester: '1' | '2';
}
export interface SubjectDetailResponse {
  subject: Subject;
  teachers: Teacher[];
  classes: ClassType[];
  assignments: any[];
  schedules: any[];
}

// Dành cho các hoạt động đặc biệt như Chào cờ, Sinh hoạt chủ nhiệm, ...
export interface Activity {
  _id?: string;
  name: string; // Ví dụ: "Chào cờ", "Sinh hoạt chủ nhiệm"
  code?: string; // Ví dụ: CHAOC0, SHCN
  type: 'weekly' | 'special'; // Loại hoạt động
  grades?: string[]; // Lớp áp dụng (10,11,12)
  dayOfWeek?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  timeSlot?: string; // "Tiết 1", "07:00 - 07:45"
  description?: string;
  startDate: string; // ISO date string (vd: "2025-09-01")
  endDate: string; // ISO date string
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Dữ liệu khi tạo hoặc cập nhật activity
export interface ActivityInput {
  name: string;
  code?: string;
  type: 'weekly' | 'special';
  grades?: string[];
  dayOfWeek?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  timeSlot?: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

// ==================== 🧩 Exam (Lịch thi) ====================

export interface Exam {
  _id?: string;
  name: string;                     // Tên kỳ thi, ví dụ: "Giữa kỳ I"
  subjectId: Subject | string;      // Môn học
  classId: ClassType | string;      // Lớp thi
  date: string;                     // Ngày thi (ISO string)
  startTime: string;                // Giờ bắt đầu (vd: "08:00")
  endTime: string;                  // Giờ kết thúc (vd: "09:30")
  room: string;                     // Phòng thi
  examiner?: string;                // Giáo viên coi thi
  note?: string;                    // Ghi chú
  createdAt?: string;
  updatedAt?: string;
}

export interface ExamInput {
  name: string;
  subjectId: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  examiner?: string;
  note?: string;
}



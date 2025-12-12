/**
 * TypeScript Types
 */

export interface User {
  _id: string;
  uid: string;
  accountId: string;
  name: string;
  email: string;
  phone?: string;
  role: 'student' | 'teacher' | 'admin';
  studentId?: string;
  teacherId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Schedule {
  _id: string;
  classId: {
    _id: string;
    className: string;
    grade: string;
  };
  year: string;
  semester: string;
  timetable: TimetableDay[];
}

export interface TimetableDay {
  day: string;
  periods: Period[];
}

export interface Period {
  period: number;
  subject: string;
  subjectId?: string;
  teacher: string;
  teacherId?: string;
}

export interface Grade {
  _id: string;
  studentId: string;
  subjectId: {
    _id: string;
    name: string;
  };
  classId: {
    _id: string;
    className: string;
  };
  year: string;
  semester: string;
  gradeItems: GradeItem[];
  summary: GradeSummary;
}

export interface GradeItem {
  type: 'mieng' | '15phut' | '1tiet' | 'hocky';
  value: number;
  coefficient: number;
  date?: string;
}

export interface GradeSummary {
  mieng: number;
  '15phut': number;
  '1tiet': number;
  hocky: number;
  final: number;
}

export interface ExamSchedule {
  _id: string;
  exam: {
    _id: string;
    name: string;
    year: string;
    semester: string;
  };
  subject: {
    _id: string;
    name: string;
  };
  grade: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'all' | 'role' | 'class' | 'user';
  recipients: string[];
  createdAt: string;
  isRead: boolean;
}


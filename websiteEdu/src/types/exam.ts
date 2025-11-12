// types/exam.ts
import { Class } from './school';
import { Subject } from './class';
import { Teacher } from './auth';

export interface ExamTerm {
  _id?: string;
  name: string;
  type: 'midterm' | 'final' | 'regular' | 'quiz' | 'graduation';
  startDate: Date | string;
  endDate: Date | string;
  status: 'upcoming' | 'in_progress' | 'completed';
  schoolYear: string;
  semester: 1 | 2;
  grades: string[];
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExamSchedule {
  _id?: string;
  examId: string;
  examClassId: string;
  subjectId: string;
  roomId: string;
  date: Date | string;
  startTime: string;
  duration: number;
  endTime?: string;
  examType: 'midterm' | 'final' | 'regular' | 'quiz' | 'graduation';
  studentsInRoom: number;
  sbdRange?: {
    from: string;
    to: string;
  };
  invigilators: string[]; // Teacher IDs
  status: 'draft' | 'confirmed' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;

  // Populated fields
  examClass?: {
    classId: Class;
  };
  subject?: Subject;
  room?: {
    code: string;
  };
  invigilatorDetails?: Teacher[];
}

// Form data cho tạo/sửa lịch thi
export interface ExamScheduleFormData {
  examId: string;
  examClassId: string;
  subjectId: string;
  roomId: string;
  date: Date;
  startTime: string;
  duration: number;
  examType: ExamSchedule['examType'];
  studentsInRoom: number;
  invigilators: string[];
}

// Response khi validate xung đột
export interface ExamConflictResponse {
  valid: boolean;
  conflicts: Array<{
    type: 'room' | 'teacher';
    s1: ExamSchedule;
    s2: ExamSchedule;
    teachers?: string[];
  }>;
}

// Params cho API get schedules
export interface ExamScheduleQueryParams {
  examId?: string;
  classId?: string;
  roomId?: string;
  grade?: string;
  studentId?: string;
  date?: string;
}
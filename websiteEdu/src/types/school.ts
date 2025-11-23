export interface Student {
  id: string;
  name: string;
  classId: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  parentName?: string;
  parentPhone?: string;
}

export interface Class {
  id: string;
  name: string;
  grade: number;
  teacherId: string; // homeroom teacher
  students?: Student[];
}

// export interface Subject {
//   id: string;
//   name: string;
//   code: string;
// }

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  semester: number;
  year: number;
  // 3 cột miệng, 3 cột 15p, 2 cột giữa kì, 1 cột cuối kì
  oral1?: number;
  oral2?: number;
  oral3?: number;
  test15min1?: number;
  test15min2?: number;
  test15min3?: number;
  midterm1?: number;
  midterm2?: number;
  finalExam?: number;
}

export interface Schedule {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number; // 2-7 (Monday to Saturday)
  period: number; // 1-10
  room?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  present: boolean;
  reason?: string;
}
import { User } from '@/types/auth';
import { Student, Class, Subject, Grade, Schedule, Attendance } from '@/types/school';

// Mock users for testing
export const mockUsers: User[] = [
  // Admin
  {
    id: 'admin1',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Nguyễn Văn Admin',
    email: 'admin@school.edu.vn'
  },
  // Teachers
  {
    id: 'teacher1',
    username: 'teacher1',
    password: 'teacher123',
    role: 'teacher',
    name: 'Trần Thị Lan',
    email: 'lan.tran@school.edu.vn',
    subjectIds: ['math', 'physics']
  },
  {
    id: 'teacher2',
    username: 'teacher2',
    password: 'teacher123',
    role: 'teacher',
    name: 'Lê Văn Minh',
    email: 'minh.le@school.edu.vn',
    subjectIds: ['literature', 'history']
  },
  // Students
  {
    id: 'student1',
    username: 'student1',
    password: 'student123',
    role: 'student',
    name: 'Hoàng Văn An',
    email: 'an.hoang@student.edu.vn',
    classId: 'class1'
  },
  {
    id: 'student2',
    username: 'student2',
    password: 'student123',
    role: 'student',
    name: 'Nguyễn Thị Bình',
    email: 'binh.nguyen@student.edu.vn',
    classId: 'class1'
  }
];

export const mockSubjects: Subject[] = [
  { id: 'math', name: 'Toán học', code: 'TOAN' },
  { id: 'physics', name: 'Vật lý', code: 'VATLY' },
  { id: 'chemistry', name: 'Hóa học', code: 'HOAHOC' },
  { id: 'literature', name: 'Ngữ văn', code: 'NGUVAN' },
  { id: 'history', name: 'Lịch sử', code: 'LICHSU' },
  { id: 'geography', name: 'Địa lý', code: 'DIALY' },
  { id: 'english', name: 'Tiếng Anh', code: 'TIENGANH' },
  { id: 'biology', name: 'Sinh học', code: 'SINHHOC' }
];

export const mockClasses: Class[] = [
  {
    id: 'class1',
    name: '10A1',
    grade: 10,
    teacherId: 'teacher1'
  },
  {
    id: 'class2',
    name: '10A2',
    grade: 10,
    teacherId: 'teacher2'
  },
  {
    id: 'class3',
    name: '11A1',
    grade: 11,
    teacherId: 'teacher1'
  }
];

export const mockStudents: Student[] = [
  {
    id: 'student1',
    name: 'Hoàng Văn An',
    classId: 'class1',
    email: 'an.hoang@student.edu.vn',
    phone: '0987654321',
    address: '123 Đường ABC, Quận 1, TP.HCM',
    dateOfBirth: '2007-03-15',
    parentName: 'Hoàng Văn Bảo',
    parentPhone: '0123456789'
  },
  {
    id: 'student2',
    name: 'Nguyễn Thị Bình',
    classId: 'class1',
    email: 'binh.nguyen@student.edu.vn',
    phone: '0987654322',
    address: '456 Đường DEF, Quận 2, TP.HCM',
    dateOfBirth: '2007-07-20',
    parentName: 'Nguyễn Văn Cường',
    parentPhone: '0123456790'
  },
  {
    id: 'student3',
    name: 'Trần Minh Châu',
    classId: 'class1',
    email: 'chau.tran@student.edu.vn',
    phone: '0987654323',
    address: '789 Đường GHI, Quận 3, TP.HCM',
    dateOfBirth: '2007-05-10',
    parentName: 'Trần Văn Dũng',
    parentPhone: '0123456791'
  }
];

export const mockGrades: Grade[] = [
  {
    id: 'grade1',
    studentId: 'student1',
    subjectId: 'math',
    semester: 1,
    year: 2024,
    oral1: 8.5,
    oral2: 9.0,
    oral3: 7.5,
    test15min1: 8.0,
    test15min2: 8.5,
    test15min3: 9.0,
    midterm1: 8.0,
    midterm2: 8.5,
    finalExam: 8.2
  },
  {
    id: 'grade2',
    studentId: 'student1',
    subjectId: 'physics',
    semester: 1,
    year: 2024,
    oral1: 7.5,
    oral2: 8.0,
    oral3: 8.5,
    test15min1: 7.0,
    test15min2: 8.0,
    test15min3: 8.5,
    midterm1: 7.5,
    midterm2: 8.0,
    finalExam: 7.8
  }
];

export const mockSchedule: Schedule[] = [
  // Monday
  { id: 'sch1', classId: 'class1', subjectId: 'math', teacherId: 'teacher1', dayOfWeek: 2, period: 1, room: 'A101' },
  { id: 'sch2', classId: 'class1', subjectId: 'literature', teacherId: 'teacher2', dayOfWeek: 2, period: 2, room: 'A101' },
  { id: 'sch3', classId: 'class1', subjectId: 'english', teacherId: 'teacher1', dayOfWeek: 2, period: 3, room: 'A101' },
  
  // Tuesday
  { id: 'sch4', classId: 'class1', subjectId: 'physics', teacherId: 'teacher1', dayOfWeek: 3, period: 1, room: 'A101' },
  { id: 'sch5', classId: 'class1', subjectId: 'chemistry', teacherId: 'teacher2', dayOfWeek: 3, period: 2, room: 'A101' },
  { id: 'sch6', classId: 'class1', subjectId: 'math', teacherId: 'teacher1', dayOfWeek: 3, period: 3, room: 'A101' },
  
  // Wednesday
  { id: 'sch7', classId: 'class1', subjectId: 'literature', teacherId: 'teacher2', dayOfWeek: 4, period: 1, room: 'A101' },
  { id: 'sch8', classId: 'class1', subjectId: 'history', teacherId: 'teacher2', dayOfWeek: 4, period: 2, room: 'A101' },
  { id: 'sch9', classId: 'class1', subjectId: 'geography', teacherId: 'teacher1', dayOfWeek: 4, period: 3, room: 'A101' },
];

export const mockAttendance: Attendance[] = [
  {
    id: 'att1',
    studentId: 'student1',
    date: '2024-01-15',
    present: true
  },
  {
    id: 'att2',
    studentId: 'student2',
    date: '2024-01-15',
    present: false,
    reason: 'Ốm'
  },
  {
    id: 'att3',
    studentId: 'student1',
    date: '2024-01-16',
    present: true
  }
];
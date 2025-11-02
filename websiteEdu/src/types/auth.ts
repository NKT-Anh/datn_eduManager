export type UserRole = 'student' | 'teacher' | 'admin';
import { Account } from './student'; // hoặc file chứa type Account
import { ClassType } from './class';

// export interface User {
//   id: string;
//   username: string;
//   password: string;
//   role: UserRole;
//   name: string;
//   email?: string;
//   classId?: string; // for students
//   subjectIds?: string[]; // for teachers
// }

// export interface AuthState {
//   user: User | null;
//   isAuthenticated: boolean;
// }






export interface ParentInfo {
  _id?: string;
  name?: string;
  phone?: string;
  occupation?: string;
  relation?: "father" | "mother" | "guardian";
}
// Học sinh theo backend
export interface Student {
  _id: string;
  studentCode?: string;
  name: string;
  dob?: string; // ISO string
  gender?: "male" | "female" | "other";
  address?: string;
  phone?: string;
    classId?: {
    _id: string;
    className: string;
    grade: string;
  } | null;
  admissionYear?: number;
  grade?: "10" | "11" | "12";
  status?: "active" | "inactive";
  parents?: ParentInfo[];
  accountId?: Account | null; // populated từ backend
}

export interface Teacher {
  _id: string;
  teacherCode?: string;
  name: string;
  phone?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  accountId?: Account | null;

  // Môn giảng dạy
  mainSubject?: {
    _id: string;
    name: string;
    code: string;
  };
  subjects?: {
    subjectId: {
      _id: string;
      name: string;
      code: string;
    };
    grades: Array<'10' | '11' | '12'>;
  }[];

  // Lớp
  classIds?: {
    _id: string;
    classCode: string;
    className: string;
    grade: '10' | '11' | '12';
    year?: string;
  }[];
  homeroomClassIds?: {
    _id: string;
    classCode: string;
    className: string;
    grade: '10' | '11' | '12';
    year?: string;
  }[];

  // Thông tin công tác
  hireYear?: number;           // năm về trường
  hireYearInField?: number;    // năm vào ngành
  weeklyLessons?: number;      // số tiết/tuần
  status?: 'active' | 'inactive';
  school?: string;
  position?: string;

  // Thông tin chuyên môn
  qualification?: string;        // bằng cấp / trình độ
  specialization?: string;       // chuyên ngành đào tạo
  teachingExperience?: number;   // thâm niên công tác (số năm)
  certifications?: string;     // chứng chỉ / khóa đào tạo

  // Thông tin bổ sung
  notes?: string;
  profilePhoto?: string;
   maxClasses?: number;

  createdAt?: string;
  updatedAt?: string;
}



// Dữ liệu form khi thêm/sửa học sinh
export interface StudentFormValues {
  _id?: string;
  studentCode?: string;
  name: string;
  dob?: string;
  gender: "male" | "female" | "other";
  phone?: string;
  address?: string;
  classId?: string | null;
  admissionYear: number;
  grade: "10" | "11" | "12";
  status: "active" | "inactive";
  parents: ParentInfo[]; // 👈 thay vì fatherName, motherName...
}

// Học sinh hiển thị ở bảng
export interface StudentRow extends Student {
  entranceScore?: number;
  gpa?: number;
}

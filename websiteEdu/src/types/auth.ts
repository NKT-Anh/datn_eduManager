export type UserRole = 'student' | 'teacher' | 'admin';
import { Account } from './student';





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
  status?: "active" | "inactive" | "graduated" | "suspended" | "transferred";
  parents?: ParentInfo[];
  accountId?: Account | null; // populated từ backend
  // 🆕 Thông tin cá nhân mở rộng
  ethnic?: string; // Dân tộc
  religion?: string; // Tôn giáo
  idNumber?: string; // CCCD / CMND
  birthPlace?: string; // Nơi sinh
  hometown?: string; // Quê quán
  avatarUrl?: string; // Ảnh đại diện
  note?: string; // Ghi chú thêm
  currentYear?: string; // ví dụ: "2025-2026"
  isDeleted?: boolean; // 👈 bổ sung để khớp dữ liệu backend
  createdAt?: string;
  updatedAt?: string;
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
  currentHomeroomClassId?: {
    _id: string;
    classCode: string;
    className: string;
    grade: '10' | '11' | '12';
    year?: string;
  } | string | null;

  // Thông tin công tác
  hireYear?: number;           // năm về trường
  hireYearInField?: number;    // năm vào ngành
  weeklyLessons?: number;      // số tiết/tuần
  optionalWeeklyLessons?: number; // ✅ Số tiết tự chọn bổ sung (admin/BGH có thể nhập)
  effectiveWeeklyLessons?: number; // ✅ Tổng số tiết thực tế/tuần (tính từ weeklyLessons + optionalWeeklyLessons, có xét chức vụ)
  status?: 'active' | 'inactive';
  school?: string;
  position?: string;
  // ✅ Số lớp tối đa cho từng khối (10, 11, 12)
  maxClassPerGrade?: Record<'10' | '11' | '12', number> | Map<string, number>;

  // Thông tin chuyên môn
  qualification?: string;        // bằng cấp / trình độ
  specialization?: string;       // chuyên ngành đào tạo
  teachingExperience?: number;   // thâm niên công tác (số năm)
  certifications?: string;     // chứng chỉ / khóa đào tạo

  // Thông tin bổ sung
  notes?: string;
  avatarUrl?: string;
  maxClasses?: number;
  
  // Lịch dạy
  availableMatrix?: boolean[][]; // Ma trận lịch trống (6 ngày x 10 tiết)

  // Tổ bộ môn
  // NOTE: department membership is now year-scoped and stored in `yearRoles`.
  // The legacy `departmentId` top-level field is intentionally omitted from this type
  // to encourage using per-year data. Backends may still populate legacy `departmentId`.

  // Lịch sử role theo năm học (nếu backend cung cấp)
  yearRoles?: {
    schoolYear: string;
    departmentId?: { _id: string; name?: string; code?: string } | string | null;
    isHomeroom?: boolean;
    isDepartmentHead?: boolean;
    isLeader?: boolean;
    permissions?: string[];
    // Optional year-scoped subjects (tổ hợp môn) for that school year
    subjects?: {
      subjectId: {
        _id: string;
        name: string;
        code: string;
      } | string;
      grades?: Array<'10' | '11' | '12'>;
    }[];
  }[];

  // Các flags cho giáo viên
  isHomeroom?: boolean;        // Giáo viên chủ nhiệm
  isDepartmentHead?: boolean;  // Trưởng bộ môn (Tổ trưởng chuyên môn)
  isLeader?: boolean;          // Ban giám hiệu

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
  status: "active" | "inactive" | "graduated" | "suspended" | "transferred";
  parents: ParentInfo[]; // 👈 thay vì fatherName, motherName...

    // 🆕 Field bổ sung
  ethnic?: string;
  religion?: string;
  idNumber?: string;
  birthPlace?: string;
  hometown?: string;
  avatarUrl?: string;
  note?: string;
}

// Học sinh hiển thị ở bảng
export interface StudentRow extends Student {
  entranceScore?: number;
  gpa?: number;
}

export interface ProfileBase {
  _id: string;
  role: "student" | "teacher" | "admin" | "parent";
  name: string;
  email?: string;
  phone?: string;
  dob?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  avatarUrl?: string;
  note?: string;
  ethnic?: string;
    status: "active" | "inactive" | "graduated" | "suspended" | "transferred";

  religion?: string;
  idNumber?: string;
  birthPlace?: string;
  hometown?: string;
}

export type Profile =
  | (ProfileBase & Student)
  | (ProfileBase & Teacher)
  | (ProfileBase & {
      department?: string;
      position?: string;
    });
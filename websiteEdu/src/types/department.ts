import { Teacher } from './auth';
import { Subject } from './class';

/**
 * 📚 Tổ Bộ Môn (Department)
 */
export interface Department {
  _id: string;
  name: string; // Ví dụ: "Tổ Toán", "Tổ Văn"
  code?: string; // Ví dụ: "TOAN", "VAN"
  description?: string;
  headTeacherId?: {
    _id: string;
    name: string;
    teacherCode?: string;
    accountId?: {
      email?: string;
    };
  } | string | null; // Trưởng bộ môn
  teacherIds?: string[]; // ✅ Danh sách thành viên tham gia tổ bộ môn
  subjectIds?: Subject[] | string[]; // Danh sách môn học
  status?: 'active' | 'inactive';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Dữ liệu khi tạo/cập nhật tổ bộ môn
 */
export interface DepartmentInput {
  name: string;
  code?: string;
  description?: string;
  headTeacherId?: string | null;
  subjectIds?: string[];
  notes?: string;
  status?: 'active' | 'inactive';
}

/**
 * Thống kê tổ bộ môn
 */
export interface DepartmentStats {
  department: {
    _id: string;
    name: string;
    code?: string;
  };
  stats: {
    teacherCount: number;
    subjectCount: number;
    homeroomTeacherCount: number;
  };
}

export interface DepartmentAssignmentStat {
  subjectId: string;
  subjectName: string;
  grades: string[];
  totalClassesNeeded: number;
  assignedClasses: number;
  missingClasses: number;
  totalPeriodsNeeded: number;
  assignedPeriods: number;
  missingPeriods: number;
}

export interface DepartmentAssignmentStatsResponse {
  department: {
    _id: string;
    name: string;
    code?: string;
  };
  filters: {
    year: string;
    semester?: string | null;
  };
  stats: DepartmentAssignmentStat[];
  summary: {
    totalSubjects: number;
    totalClassesNeeded: number;
    totalClassesAssigned: number;
    totalClassesMissing: number;
    totalPeriodsNeeded: number;
    totalPeriodsAssigned: number;
    totalPeriodsMissing: number;
  };
}













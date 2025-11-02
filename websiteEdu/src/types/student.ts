// Thông tin phụ huynh
export interface ParentInfo {
  _id?: string;
  name?: string;
  phone?: string;
  occupation?: string;
  relation?: "father" | "mother" | "guardian";
}

// Thông tin tài khoản gắn với học sinh
export interface Account {
  _id: string;
  email: string;
  role: string;
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

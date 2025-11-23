// // Thông tin phụ huynh
// export interface ParentInfo {
//   _id?: string;
//   name?: string;
//   phone?: string;
//   occupation?: string;
//   relation?: "father" | "mother" | "guardian";
// }

// Thông tin tài khoản gắn với học sinh
export interface Account {
  _id: string;
  email: string;
  role: string;
}

// // Học sinh theo backend
// export interface Student {
//   _id: string;
//   studentCode?: string;
//   name: string;
//   dob?: string; // ISO string
//   gender?: "male" | "female" | "other";
//   address?: string;
//   phone?: string;
//      classId?: {
//     _id: string;
//     className: string;
//     grade: string;
//   } | null;
//   admissionYear?: number;
//   grade?: "10" | "11" | "12";
//   status?: "active" | "inactive";
//   parents?: ParentInfo[];
//   currentYear?: string; // VD: "2025-2026"
//   accountId?: Account | null; // populated từ backend
// }

// // Dữ liệu form khi thêm/sửa học sinh
// export interface StudentFormValues {
//   _id?: string;
//   studentCode?: string;
//   name: string;
//   dob?: string;
//   gender: "male" | "female" | "other";
//   phone?: string;
//   address?: string;
//   classId?: string | null;
//   admissionYear: number;
//   grade: "10" | "11" | "12";
//   status: "active" | "inactive";
//   parents: ParentInfo[]; // 👈 thay vì fatherName, motherName...
// }

// // Học sinh hiển thị ở bảng
// export interface StudentRow extends Student {
//   entranceScore?: number;
//   gpa?: number;
// }
export interface StudentExcelRow {
  "STT"?: number;
  "Mã học sinh"?: string;
  "Họ tên": string;
  "Giới tính"?: "Nam" | "Nữ" | "Khác";
  "Ngày sinh"?: string;
  "Khối"?: string;              // 10 / 11 / 12
  "Lớp"?: string;              // Tên lớp
  "Năm nhập học"?: number;
    "Năm học hiện tại"?: string; // ví dụ: "2025-2026"
  "Số điện thoại"?: string;
  "Địa chỉ"?: string;
  "Trạng thái"?: "Đang học" | "Nghỉ học" | "Tốt nghiệp" | "Chuyển trường";
  "Email"?: string;
  "Dân tộc"?: string;
  "Tôn giáo"?: string;
  "CCCD"?: string;
  "Nơi sinh"?: string;
  "Quê quán"?: string;
  "Ghi chú"?: string;

}

/**
 * Dữ liệu import đã chuẩn hóa sang payload dùng cho API
 */
export interface StudentImportPayload {
  name: string;
  gender: "male" | "female" | "other";
  dob?: string;
  grade: "10" | "11" | "12";
  classId?: string | null;
  admissionYear: number;
  currentYear?: string; // ví dụ: "2025-2026"
  phone?: string;
  address?: string;
  status: "active" | "inactive" | "graduated" | "transferred";
  studentCode?: string;
  ethnic?: string;
  religion?: string;
  idNumber?: string;
  birthPlace?: string;
  hometown?: string;
  note?: string;
    

}

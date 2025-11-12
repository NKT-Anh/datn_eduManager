// src/services/studentApi.ts
import api from "@/services/axiosInstance";
import { Account } from "@/types/student";

/* =========================================================
   📘 Interfaces
========================================================= */
export interface ParentPayload {
  _id?: string;
  name?: string;
  phone?: string;
  occupation?: string;
  relation?: "father" | "mother" | "guardian";
}

export interface StudentCreatePayload {
  studentCode?: string;
  name: string;
  dob?: string | null;
  gender?: "male" | "female" | "other";
  address?: string;
  phone?: string;
  classId?: string | null;
  admissionYear?: number;
  grade?: "10" | "11" | "12";
  status?: "active" | "inactive" | "graduated" | "suspended" | "transferred";
  parents?: ParentPayload[];
  accountId?: Account | null;

  // 🆕 Bổ sung thông tin cá nhân mở rộng (theo backend)
  ethnic?: string;
  religion?: string;
  idNumber?: string;
  birthPlace?: string;
  hometown?: string;
  avatarUrl?: string;
  note?: string;
}

export interface StudentUpdatePayload extends Partial<StudentCreatePayload> {}

/* =========================================================
   📡 API functions (dùng axiosInstance -> tự gắn token)
========================================================= */
const studentApi = {
  // 📋 Lấy danh sách học sinh (hỗ trợ params: page, limit, grade, classId, year, search...)
  async getAll(params?: Record<string, any>) {
    const res = await api.get("/students", { params });
    return res.data;
  },

  // 🔍 Lấy chi tiết 1 học sinh
  async getById(id: string) {
    const res = await api.get(`/students/${id}`);
    return res.data;
  },

  // ➕ Tạo mới học sinh
  async create(payload: StudentCreatePayload) {
    const res = await api.post("/students", payload);
    return res.data;
  },

  // ✏️ Cập nhật thông tin học sinh
  async update(id: string, payload: StudentUpdatePayload) {
    try {
      const res = await api.put(`/students/${id}`, payload);
      return res.data;
    } catch (err: any) {
      console.error(`Error updating student ${id}:`, err.response?.data || err.message);
      throw new Error(err.response?.data?.message || "Failed to update student");
    }
  },

  // 🗑️ Xóa học sinh
  async remove(id: string) {
    const res = await api.delete(`/students/${id}`);
    return res.data;
  },

  // 🔑 Tạo tài khoản Firebase cho học sinh (backend sẽ tạo user & Account)
  async createAccount(studentId: string) {
    const res = await api.post("/students/create-account", { studentId });
    return res.data;
  },

  // ❌ Xóa parent (nếu backend hỗ trợ route)
  async deleteParent(parentId: string) {
    const res = await api.delete(`/students/parent/${parentId}`);
    return res.data;
  },

  // 📥 Import / bulk create (nếu cần)
  async bulkCreate(data: StudentCreatePayload[]) {
    const res = await api.post("/students/bulk", { students: data });
    return res.data;
  },
  // 📘 Phân lớp tự động cho học sinh (backend sẽ chia đều theo khối + năm học)
async autoAssignToClasses(year: string) {
  const res = await api.post("/students/auto-assign", { year });
  return res.data;
},

};

export default studentApi;

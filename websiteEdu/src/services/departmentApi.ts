import api from "./axiosInstance";
import type { Department, DepartmentInput, DepartmentStats } from "@/types/department";
import type { Teacher } from "@/types/auth";
import type { Subject } from "@/types/class";

const BASE = "/departments";

export const departmentApi = {
  // Lấy tất cả tổ bộ môn
  getAll: async (): Promise<Department[]> => {
    const res = await api.get<Department[]>(BASE);
    return res.data;
  },

  // Lấy 1 tổ bộ môn theo ID
  getById: async (id: string): Promise<Department> => {
    const res = await api.get<Department>(`${BASE}/${id}`);
    return res.data;
  },

  // Tạo tổ bộ môn mới
  create: async (payload: DepartmentInput): Promise<Department> => {
    const res = await api.post<Department>(BASE, payload);
    return res.data;
  },

  // Cập nhật tổ bộ môn
  update: async (id: string, payload: Partial<DepartmentInput>): Promise<Department> => {
    const res = await api.put<Department>(`${BASE}/${id}`, payload);
    return res.data;
  },

  // Xóa tổ bộ môn
  delete: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`${BASE}/${id}`);
    return res.data;
  },

  // Lấy danh sách giáo viên trong tổ (hỗ trợ query params như year)
  getTeachers: async (id: string, params?: { year?: string }): Promise<Teacher[]> => {
    const res = await api.get<Teacher[]>(`${BASE}/${id}/teachers`, { params });
    return res.data;
  },

  // Lấy danh sách môn học trong tổ
  getSubjects: async (id: string): Promise<Subject[]> => {
    const res = await api.get<Subject[]>(`${BASE}/${id}/subjects`);
    return res.data;
  },

  // Lấy thống kê tổ bộ môn
  getStats: async (id: string): Promise<DepartmentStats> => {
    const res = await api.get<DepartmentStats>(`${BASE}/${id}/stats`);
    return res.data;
  },

  // ✅ Thống kê phân công môn học trong tổ
  getAssignmentStats: async (
    id: string,
    params: { year: string; semester?: string }
  ) => {
    const res = await api.get(`${BASE}/${id}/assignment-stats`, { params });
    return res.data;
  },

  // Thêm giáo viên vào tổ bộ môn
  addTeacher: async (departmentId: string, teacherId: string): Promise<Teacher> => {
    const res = await api.post<Teacher>(`${BASE}/${departmentId}/teachers`, { teacherId });
    return res.data;
  },

  // Xóa giáo viên khỏi tổ bộ môn
  removeTeacher: async (departmentId: string, teacherId: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`${BASE}/${departmentId}/teachers?teacherId=${teacherId}`);
    return res.data;
  },

  // Sao chép tổ bộ môn từ năm học khác
  copyFromYear: async (fromYear: string, toYear: string): Promise<{
    message: string;
    copied: any[];
    errors?: any[];
    total: number;
    success: number;
    failed: number;
  }> => {
    const res = await api.post(`${BASE}/copy-from-year`, { fromYear, toYear });
    return res.data;
  },
};


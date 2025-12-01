import axios from "axios";
import api from "./axiosInstance";
import { ClassType } from "../types/class";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/* =========================================================
   🏫 API QUẢN LÝ LỚP (YÊU CẦU ĐĂNG NHẬP)
========================================================= */
export const classApi = {
  /* =========================================================
     📋 LẤY DANH SÁCH LỚP
  ========================================================= */
  async getAll(params?: any): Promise<ClassType[]> {
    const res = await api.get("/class", {
      params: { isDeleted: 'false', ...params }
    });
    return res.data;
  },

  /* =========================================================
     🔍 LẤY CHI TIẾT LỚP
  ========================================================= */
  async getById(id: string): Promise<ClassType> {
    const res = await api.get(`/class/${id}`);
    return res.data;
  },

  /* =========================================================
     📘 LẤY CÁC LỚP THEO NIÊN KHÓA
  ========================================================= */
  async getByYear(year: string): Promise<ClassType[]> {
    const res = await api.get("/class", { params: { year } });
    return res.data;
  },

  /* =========================================================
     🧭 LẤY KHỐI & LỚP TRONG NIÊN KHÓA (group theo khối)
  ========================================================= */
  async getGradesAndClassesByYear(
    year: string
  ): Promise<{ grade: string; classes: ClassType[] }[]> {
    const res = await api.get("/class", { params: { year } });
    const classes: ClassType[] = res.data;

    const grouped: Record<string, ClassType[]> = {};
    for (const cls of classes) {
      if (!grouped[cls.grade]) grouped[cls.grade] = [];
      grouped[cls.grade].push(cls);
    }

    return Object.entries(grouped).map(([grade, classList]) => ({
      grade,
      classes: classList.sort((a, b) => a.className.localeCompare(b.className)),
    }));
  },

  /* =========================================================
     ➕ TẠO LỚP MỚI
  ========================================================= */
  async create(
    data: Omit<ClassType, "_id" | "teacherId" | "students" | "classCode">
  ): Promise<ClassType> {
    try {
      const res = await api.post("/class", data);
      return res.data;
    } catch (err: any) {
      console.error("❌ Create class error:", err.response?.data || err.message);
      throw err;
    }
  },

  /* =========================================================
     ✏️ CẬP NHẬT LỚP
  ========================================================= */
  async update(id: string, data: any): Promise<ClassType> {
    try {
      const res = await api.put(`/class/${id}`, data);
      return res.data;
    } catch (err: any) {
      console.error("❌ Update class error:", err.response?.data || err.message);
      throw err;
    }
  },

  /* =========================================================
     🗑️ XÓA LỚP
  ========================================================= */
  async remove(id: string): Promise<{ message: string }> {
    try {
      const res = await api.delete(`/class/${id}`);
      return res.data;
    } catch (err: any) {
      console.error("❌ Delete class error:", err.response?.data || err.message);
      throw err;
    }
  },

  /* =========================================================
     ⚙️ KHỞI TẠO / TỰ ĐỘNG PHÂN LỚP
  ========================================================= */
  async autoAssign(params: {
    year?: number;
    grade?: string;
    minScore?: number;
  }): Promise<ClassType[]> {
    const res = await api.get("/class/auto-assign", { params });
    return res.data;
  },

  async setupYear(data: {
    year?: number;
    grade?: string;
    count?: number;
    capacity?: number;
  }): Promise<ClassType[]> {
    const res = await api.post("/class/setup-year", data);
    return res.data;
  },

  /* =========================================================
     👩‍🏫 GIA NHẬP LỚP
  ========================================================= */
  async joinClass(data: { userId: string; classCode: string }): Promise<ClassType[]> {
    const res = await api.post("/class/join-class", data);
    return res.data;
  },

  /* =========================================================
     🏫 GẮN PHÒNG CHO LỚP
  ========================================================= */
  async assignRoom(classId: string, roomId: string | null): Promise<ClassType> {
    try {
      const res = await api.put(`/class/${classId}/room`, { roomId });
      return res.data.data;
    } catch (err: any) {
      console.error("❌ Assign room error:", err.response?.data || err.message);
      throw err;
    }
  },

  /* =========================================================
     🏫 TỰ ĐỘNG GÁN PHÒNG CHO CÁC LỚP
  ========================================================= */
  async autoAssignRooms(year?: string, reassignAll?: boolean): Promise<{
    message: string;
    assigned: number;
    skipped: number;
    failed: number;
    details: Array<{
      className: string;
      status: 'assigned' | 'skipped' | 'failed';
      roomCode?: string;
      reason?: string;
    }>;
  }> {
    try {
      const params: any = {};
      if (year && year !== 'Tất cả') {
        params.year = year;
      }
      if (reassignAll) {
        params.reassignAll = 'true';
      }
      const res = await api.post('/class/auto-assign-rooms', {}, { params });
      return res.data;
    } catch (err: any) {
      console.error("❌ Auto assign rooms error:", err.response?.data || err.message);
      throw err;
    }
  },

  /* =========================================================
     👩‍🏫 TỰ ĐỘNG GÁN GIÁO VIÊN CHỦ NHIỆM CHO CÁC LỚP
  ========================================================= */
  async autoAssignHomeroomTeachers(year?: string, reassignAll?: boolean): Promise<{
    message: string;
    assigned: number;
    skipped: number;
    failed: number;
    details: Array<{
      className: string;
      status: 'assigned' | 'skipped' | 'failed';
      teacherName?: string;
      teacherCode?: string;
      reason?: string;
    }>;
  }> {
    try {
      const params: any = {};
      if (year && year !== 'Tất cả') {
        params.year = year;
      }
      if (reassignAll) {
        params.reassignAll = 'true';
      }
      const res = await api.post('/class/auto-assign-homeroom-teachers', {}, { params });
      return res.data;
    } catch (err: any) {
      console.error("❌ Auto assign homeroom teachers error:", err.response?.data || err.message);
      throw err;
    }
  },
};

/* =========================================================
   🌐 API KHÔNG CẦN TOKEN (PUBLIC)
========================================================= */
export const classApiNoToken = {
  getAll: async (params?: Record<string, any>) => {
    const res = await api.get("/class", { params });
    return res.data;
  },

  async getById(id: string): Promise<ClassType> {
    const res = await axios.get(`${API_BASE}/class/${id}`);
    return res.data;
  },

  async getByYear(year: string): Promise<ClassType[]> {
    const res = await axios.get(`${API_BASE}/class`, { params: { year } });
    return res.data;
  },

  async create(data: Omit<ClassType, "_id" | "teacherId" | "students" | "classCode">): Promise<ClassType> {
    try {
      const res = await axios.post(`${API_BASE}/class`, data);
      return res.data;
    } catch (err: any) {
      console.error("❌ Create class error:", err.response?.data || err.message);
      throw err;
    }
  },

  async update(id: string, data: any): Promise<ClassType> {
    const res = await axios.put(`${API_BASE}/class/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<ClassType[]> {
    const res = await axios.delete(`${API_BASE}/class/${id}`);
    return res.data;
  },

  async joinClass(data: { userId: string; classCode: string }): Promise<ClassType[]> {
    const res = await axios.post(`${API_BASE}/class/join-class`, data);
    return res.data;
  },

  async autoAssign(params: { year?: number; grade?: string; minScore?: number }): Promise<ClassType[]> {
    const res = await axios.get(`${API_BASE}/class/auto-assign`, { params });
    return res.data;
  },

  async setupYear(data: { year?: number; grade?: string; count?: number; capacity?: number }): Promise<ClassType[]> {
    const res = await axios.post(`${API_BASE}/class/setup-year`, data);
    return res.data;
  },
};

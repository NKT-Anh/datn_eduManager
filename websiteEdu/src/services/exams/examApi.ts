// src/services/exams/examApi.ts
import api from "@/services/axiosInstance";

export interface Exam {
  _id?: string;
  examId?: string;
  name: string;
  year: string;
  semester: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  type?: string;
  grades?: (string | number)[];
  createdAt?: string;
  updatedAt?: string;
  isArchived?: boolean;
  gradesPublished?: boolean;
  gradesPublishedAt?: string;
  gradesPublishedBy?: string;
}

export const examApi = {
  /* =========================================================
     🟢 LẤY DANH SÁCH KỲ THI
  ========================================================= */
async getAll(params?: {
  page?: number;
  limit?: number;
  year?: string;
  semester?: string;
  type?: string;
  status?: string;
  keyword?: string;
  grade?: string[]; // đầu vào là mảng
}): Promise<{
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: Exam[];
}> {
  try {
    // 👇 Clone params để xử lý
    const queryParams: Record<string, any> = { ...params };

    // ⚙️ Nếu grade là mảng → chuyển thành chuỗi "10,11"
    if (Array.isArray(params?.grade) && params.grade.length > 0) {
      queryParams.grade = params.grade.join(",");
    }

    // 🚀 Gọi API
    const res = await api.get("/exam", { params: queryParams });

    // ✅ Trả về đúng object từ backend
    return {
      total: res.data?.total || 0,
      page: res.data?.page || 1,
      limit: res.data?.limit || 10,
      totalPages: res.data?.totalPages || 1,
      data: Array.isArray(res.data?.data) ? res.data.data : [],
    };
  } catch (error) {
    console.error("❌ Lỗi khi tải danh sách kỳ thi:", error);
    return {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
      data: [],
    };
  }
},


  /* =========================================================
     🔍 LẤY CHI TIẾT 1 KỲ THI
  ========================================================= */
  async getById(id: string): Promise<Exam | null> {
    const res = await api.get(`/exam/${id}`);
    return res.data;
  },

  /* =========================================================
     ✏️ TẠO / CẬP NHẬT / XÓA
  ========================================================= */
  async create(data: Partial<Exam>) {
    const res = await api.post("/exam", data);
    return res.data;
  },

  async update(id: string, data: Partial<Exam>) {
    const res = await api.put(`/exam/${id}`, data);
    return res.data;
  },

  async remove(id: string) {
    const res = await api.delete(`/exam/${id}`);
    return res.data;
  },

  /* =========================================================
     🔒 KHÓA / LƯU TRỮ / NHÂN BẢN
  ========================================================= */
  async lock(id: string) {
    const res = await api.patch(`/exam/${id}/lock`);
    return res.data;
  },

  async archive(id: string, isArchived = true) {
    const res = await api.patch(`/exam/${id}/archive`, { isArchived });
    return res.data;
  },

  async clone(id: string) {
    const res = await api.post(`/exam/${id}/clone`);
    return res.data;
  },

  /* =========================================================
     📊 THỐNG KÊ
  ========================================================= */
  async getStats(id: string) {
    const res = await api.get(`/exam/${id}/stats`);
    return res.data;
  },

  async getSummary() {
    try {
      const res = await api.get(`/exam/summary/status`);
      return res.data || [];
    } catch (error) {
      console.error('Error getting exam summary:', error);
      return [];
    }
  },

  async getYearlyStats() {
    try {
      const res = await api.get(`/exam/summary/year`);
      return res.data || [];
    } catch (error) {
      console.error('Error getting yearly stats:', error);
      return [];
    }
  },

  /* =========================================================
     👀 LỊCH COI THI (GIÁM THỊ)
  ========================================================= */
  async getSupervisorSchedule(params?: { limit?: number; page?: number }) {
    try {
      const res = await api.get(`/gvbm/exams/supervisor-schedule`, { params });
      // Normalize to array
      return Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error getting supervisor schedule:', error);
      return [];
    }
  },

  /* =========================================================
     📊 PHÂN TÍCH ĐIỂM THI VÀ SO SÁNH VỚI NĂM TRƯỚC
  ========================================================= */
  async getGradeAnalysis(id: string, compareWithPreviousYear: boolean = true) {
    const res = await api.get(`/exams/${id}/analysis`, {
      params: { compareWithPreviousYear },
    });
    return res.data;
  },
};

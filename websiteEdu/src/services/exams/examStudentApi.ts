import api from "@/services/axiosInstance";

export interface ExamStudent {
  _id?: string;
  exam: string;
  student: string;
  grade: number;
  class?: string;
  schedule?: string; // 🔹 nên thêm vì mỗi HS gắn vào môn thi cụ thể
  room?: string;
  status?: "registered" | "present" | "absent" | "excluded";
  sbd?: string;
  note?: string;
}

/* =========================================================
   📘 ExamStudent API — Học sinh dự thi
   🔗 Backend route: /api/exam/students/...
========================================================= */
export const examStudentApi = {
  /** 📋 Lấy danh sách học sinh dự thi theo kỳ thi hoặc lịch thi */
  async getByExam(examId: string, params?: { scheduleId?: string; grade?: number }) {
    const res = await api.get(`/exam/students/${examId}`, { params });
    return res.data;
  },

  /** 🔍 Lấy chi tiết 1 học sinh dự thi */
  async getById(id: string) {
    const res = await api.get(`/exam/students/detail/${id}`);
    return res.data;
  },

  /** ➕ Thêm hoặc gán học sinh vào kỳ thi (theo khối + lớp) */
  async addOrAssign(data: { examId: string; grade: number; classIds?: string[] }) {
    const res = await api.post("/exam/students/add", data);
    return res.data;
  },

  /** ✏️ Cập nhật thông tin học sinh dự thi */
  async update(id: string, data: Partial<ExamStudent>) {
    const res = await api.put(`/exam/students/${id}`, data);
    return res.data;
  },

  /** 🗑️ Xóa 1 học sinh khỏi kỳ thi */
  async remove(id: string) {
    const res = await api.delete(`/exam/students/${id}`);
    return res.data;
  },

  /** 🗑️ Reset toàn bộ danh sách học sinh của kỳ thi */
  async reset(examId: string) {
    const res = await api.delete(`/exam/students/reset/${examId}`);
    return res.data;
  },

  /** 📥 Import danh sách học sinh từ file Excel */
  async importExcel(formData: FormData) {
    const res = await api.post("/exam/students/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  /** 📊 Thống kê số lượng học sinh theo khối hoặc môn */
  async getStats(examId: string) {
    const res = await api.get(`/exam/students/stats/${examId}`);
    return res.data;
  },
};

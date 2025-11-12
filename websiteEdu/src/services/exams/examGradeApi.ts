import api from "@/services/axiosInstance";

export interface ExamGrade {
  _id?: string;
  exam: string;
  student: string;
  subject: string;
  gradeValue: number;
  isLocked?: boolean;
}

export const examGradeApi = {
  /** 📋 Lấy danh sách điểm theo kỳ thi */
  async getByExam(examId: string, params?: any) {
    const res = await api.get(`/exam-grades/exam/${examId}`, { params });
    return res.data;
  },

  /** 🔍 Lấy chi tiết điểm */
  async getById(id: string) {
    const res = await api.get(`/exam-grades/${id}`);
    return res.data;
  },

  /** ➕ Thêm hoặc cập nhật điểm (auto upsert) */
  async addOrUpdate(data: Partial<ExamGrade>) {
    const res = await api.post("/exam-grades", data);
    return res.data;
  },

  /** ✏️ Cập nhật điểm cụ thể */
  async update(id: string, data: any) {
    const res = await api.put(`/exam-grades/${id}`, data);
    return res.data;
  },

  /** 🗑️ Xóa điểm */
  async remove(id: string) {
    const res = await api.delete(`/exam-grades/${id}`);
    return res.data;
  },

  /** 📥 Import điểm từ file Excel */
  async importExcel(formData: FormData) {
    const res = await api.post("/exam-grades/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  /** 📤 Xuất điểm ra Excel */
  async exportExcel(examId: string) {
    const res = await api.get(`/exam-grades/export/${examId}`, {
      responseType: "blob",
    });
    return res.data;
  },

  /** 🔒 Khóa toàn bộ điểm kỳ thi */
  async lock(examId: string) {
    const res = await api.put(`/exam-grades/lock/${examId}`);
    return res.data;
  },

  /** 📊 Lấy thống kê điểm theo môn */
  async getStats(examId: string) {
    const res = await api.get(`/exam-grades/stats/${examId}`);
    return res.data;
  },
};

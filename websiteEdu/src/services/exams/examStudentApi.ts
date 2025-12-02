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
  async getByExam(examId: string, params?: { scheduleId?: string; grade?: number; limit?: number; page?: number }) {
    const res = await api.get(`/exam/students/exam/${examId}`, { params });
    return res.data;
  },

  /** 🎯 Lấy danh sách học sinh đủ điều kiện cho kỳ thi (lọc theo khối, niên khóa) */
  async getCandidates(
    examId: string,
    params?: { grade?: number; keyword?: string; limit?: number }
  ) {
    const res = await api.get(`/exam/students/exam/${examId}/candidates`, {
      params,
    });
    return res.data;
  },

  /** 🔍 Lấy chi tiết 1 học sinh dự thi */
  async getById(id: string) {
    const res = await api.get(`/exam/students/${id}`);
    return res.data;
  },

  /** ➕ Thêm hoặc gán học sinh vào kỳ thi (theo khối + lớp) */
  async addOrAssign(data: { examId: string; grade: number; classIds?: string[] }) {
    const res = await api.post("/exam/students/add", data);
    return res.data;
  },

  /** ➕ Thêm nhiều học sinh vào kỳ thi (theo danh sách ID) */
  async addMultiple(data: { examId: string; studentIds: string[] }) {
    const res = await api.post("/exam/students/add-multiple", data);
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

  /** ➕ Thêm tất cả học sinh theo khối tham gia (tự động kiểm tra và chỉ thêm học sinh chưa có) */
  async addAllStudentsByGrades(examId: string) {
    const res = await api.post(`/exam/students/exam/${examId}/add-all`);
    return res.data;
  },

  /** 📋 Lấy danh sách học sinh theo phòng thi */
  async getByRoom(roomId: string, params?: { examRoomId?: string; scheduleId?: string }) {
    const res = await api.get(`/exam/students/room/${roomId}`, { params });
    return res.data;
  },

  /** ✏️ Cập nhật nhiều học sinh */
  async updateMultiple(updates: Array<{ id: string; data: Partial<ExamStudent> }>) {
    const res = await api.put("/exam/students/bulk-update", { updates });
    return res.data;
  },

  /** 📄 Xuất danh sách học sinh theo phòng nhóm (FixedExamRoom) */
  async exportByFixedRooms(data: { examId: string; fixedRoomIds?: string[] }) {
    const res = await api.post("/exam/students/export-by-fixed-rooms", data, {
      responseType: "blob", // ✅ Quan trọng: để nhận file binary
    });
    return res.data;
  },
};

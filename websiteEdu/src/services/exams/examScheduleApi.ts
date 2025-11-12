// src/services/exams/examScheduleApi.ts
import api from "@/services/axiosInstance";
export interface ExamSchedule {
  _id?: string;
  exam: string;
  grade: number;
  subject: string;
  date: string;
  startTime: string;
  duration: number;
  examType: "midterm" | "final";
  status: "draft" | "confirmed" | "completed";
  notes?: string;
}
export const examScheduleApi = {
  /* =========================================================
     📋 LẤY TOÀN BỘ LỊCH THI (DÙNG CHO AllExamSchedulesPage)
  ========================================================= */
  async getAll(params?: any) {
    const res = await api.get(`/exam/schedules`, { params });
    // ✅ Backend trả về { total, data } hoặc mảng trực tiếp
    return res.data?.data || res.data;
  },

  /* =========================================================
     📋 LẤY DANH SÁCH LỊCH THI THEO KỲ THI
  ========================================================= */
getByExam: async (examId: string, grade?: number) => {
  const url = grade && grade !== 0
    ? `/exam/schedules/${examId}?grade=${grade}`
    : `/exam/schedules/${examId}`;
  const res = await api.get(url);
  return res.data;
},


  /* =========================================================
     ➕ TẠO MỚI LỊCH THI
  ========================================================= */
  async create(data: any) {
    const res = await api.post(`/exam/schedules`, data);
    return res.data;
  },

  /* =========================================================
     ✏️ CẬP NHẬT LỊCH THI
  ========================================================= */
  async update(id: string, data: any) {
    const res = await api.put(`/exam/schedules/${id}`, data);
    return res.data;
  },

  /* =========================================================
     🗑️ XÓA LỊCH THI
  ========================================================= */
  async remove(id: string) {
    const res = await api.delete(`/exam/schedules/${id}`);
    return res.data;
  },

  /* =========================================================
     ⚡ TỰ ĐỘNG TẠO LỊCH THI
  ========================================================= */
  async autoGenerate(examId: string, grade: number) {
    const res = await api.post(`/exam/schedules/auto-generate`, { examId, grade });
    return res.data;
  },
  updateDateTime: async (id: string, data: { date: string; startTime: string }) => {
  console.log("📡 PATCH gửi đi:", { id, ...data });

  try {
    const res = await api.patch(`/exam/schedules/${id}/datetime`, {
      date: data.date,
      startTime: data.startTime,
    });

    console.log("📥 Phản hồi từ server:", res.data);
    return res.data.data;
  } catch (err: any) {
    console.error("❌ Lỗi từ server:", err.response?.data || err.message);
    throw err;
  }
},



};

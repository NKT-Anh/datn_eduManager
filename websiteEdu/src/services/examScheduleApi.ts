import api from "@/services/axiosInstance";

export const examScheduleApi = {
  // 🔹 Lấy danh sách lịch thi
  async getAll(params?: any) {
    const res = await api.get("/exam/schedules", { params });
    return res.data;
  },

  // 🔹 Tạo lịch thi mới
  async create(data: any) {
    const res = await api.post("/exam/schedules", data);
    return res.data;
  },

  // 🔹 Cập nhật lịch thi
  async update(id: string, data: any) {
    const res = await api.put(`/exam/schedules/${id}`, data);
    return res.data;
  },

  // 🔹 Xóa lịch thi
  async remove(id: string) {
    const res = await api.delete(`/exam/schedules/${id}`);
    return res.data;
  },

  // 🔹 Lấy lịch thi theo kỳ thi
  async getByExam(examId: string) {
    const res = await api.get(`/exam/schedules/by-exam/${examId}`);
    return res.data;
  },

  // 🔹 Kiểm tra trùng lịch
  async validateConflict(data: any) {
    const res = await api.post(`/exam/schedules/validate`, data);
    return res.data;
  },
};

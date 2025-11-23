import api from "@/services/axiosInstance";

export const examClassApi = {
  // 🔹 Lấy danh sách lớp thi
  async getAll(params?: any) {
    const res = await api.get("/exam/classes", { params });
    return res.data;
  },

  // 🔹 Tạo lớp thi (theo khối hoặc theo kỳ thi)
  async create(data: any) {
    const res = await api.post("/exam/classes", data);
    return res.data;
  },

  // 🔹 Cập nhật lớp thi
  async update(id: string, data: any) {
    const res = await api.put(`/exam/classes/${id}`, data);
    return res.data;
  },

  // 🔹 Xóa lớp thi
  async remove(id: string) {
    const res = await api.delete(`/exam/classes/${id}`);
    return res.data;
  },

  // 🔹 Sinh số báo danh tự động
  async generateSBD(examId: string) {
    const res = await api.post(`/exam/classes/${examId}/generate-sbd`);
    return res.data;
  },

  // 🔹 Lấy danh sách học sinh trong lớp thi
  async getStudents(examClassId: string) {
    const res = await api.get(`/exam/classes/${examClassId}/students`);
    return res.data;
  },
};

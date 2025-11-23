import api from "@/services/axiosInstance";

export interface ExamClass {
  _id?: string;
  exam: string;
  grade: number;
  classes: string[];
}

export const examClassApi = {
  async getAll(examId?: string) {
    const res = await api.get("/exam/classes", { params: { examId } });
    return res.data;
  },
  async getById(id: string) {
    const res = await api.get(`/exam/classes/${id}`);
    return res.data;
  },
  async create(data: Partial<ExamClass>) {
    const res = await api.post("/exam/classes", data);
    return res.data;
  },
  async update(id: string, data: Partial<ExamClass>) {
    const res = await api.put(`/exam/classes/${id}`, data);
    return res.data;
  },
  async remove(id: string) {
    const res = await api.delete(`/exam/classes/${id}`);
    return res.data;
  },
  async getStats(examId: string) {
    const res = await api.get(`/exam/classes/${examId}/stats`);
    return res.data;
  },
};

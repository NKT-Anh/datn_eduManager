import api from "@/services/axiosInstance";

export interface ExamRoom {
  _id?: string;
  exam: string;
  schedule?: string;
  room?: string;
  roomCode?: string;
  capacity?: number;
  type?: "normal" | "lab" | "computer";
  grade?: number;
  isFull?: boolean;
  note?: string;
  invigilators?: { teacherId: string; role: string }[];
}

export const examRoomApi = {
  /** 📋 Lấy danh sách phòng (lọc theo examId, scheduleId, grade) */
  async getAll(params?: { examId?: string; scheduleId?: string; grade?: number }) {
    const res = await api.get("/exam/rooms", { params });
    return res.data;
  },

  /** 🏫 Lấy danh sách phòng theo kỳ thi (Exam) */
  async getByExam(examId: string) {
    const res = await api.get(`/exam/rooms/exam/${examId}`);
    return res.data;
  },

  /** 🗓️ Lấy danh sách phòng theo lịch thi (ExamSchedule) */
  async getBySchedule(scheduleId: string) {
    const res = await api.get(`/exam/rooms/schedule/${scheduleId}`);
    return res.data;
  },

  /** ➕ Tạo phòng thi thủ công */
  async create(data: ExamRoom) {
    const res = await api.post("/exam/rooms", data);
    return res.data;
  },

  /** ✏️ Cập nhật thông tin phòng thi */
  async update(id: string, data: Partial<ExamRoom>) {
    const res = await api.put(`/exam/rooms/${id}`, data);
    return res.data;
  },

  /** 🗑️ Xóa phòng thi */
  async remove(id: string) {
    const res = await api.delete(`/exam/rooms/${id}`);
    return res.data;
  },

  /** ⚡ Tự động tạo phòng thi từ danh sách phòng học gốc */
  async autoGenerateRooms(data: { examId: string; scheduleId?: string; grade?: number }) {
    const res = await api.post("/exam/rooms/auto-generate", data);
    return res.data;
  },

  /** 🎯 Tự động chia học sinh theo tên (auto distribute) */
  async autoDistribute(data: { examId: string; scheduleId?: string; grade: number }) {
    const res = await api.post("/exam/rooms/auto-distribute", data);
    return res.data;
  },

  /** 👩‍🏫 Gán giám thị cho phòng */
  async assignInvigilators(
    roomId: string,
    invigilators: { teacherId: string; role: string }[]
  ) {
    const res = await api.put(`/exam/rooms/${roomId}/invigilators`, { invigilators });
    return res.data;
  },

  /** 📊 Thống kê nhanh số phòng / sức chứa */
  async getStats(examId: string) {
    const res = await api.get(`/exam/rooms/stats/${examId}`);
    return res.data;
  },

  /** 🧾 Xuất PDF danh sách phòng thi (hỗ trợ token tải file trực tiếp) */
  async exportPdf(roomId: string) {
    const token = localStorage.getItem("firebaseToken"); // 🔐 token xác thực
    const url = `/api/exam/rooms/${roomId}/export/pdf${token ? `?token=${token}` : ""}`;
    window.open(url, "_blank");
  },
  /** 🤖 Tự động gán giám thị */
async autoAssignInvigilators(data: { examId: string; scheduleId: string }) {
  const res = await api.post("/exam/rooms/auto-assign-invigilators", data);
  return res.data;
},

};

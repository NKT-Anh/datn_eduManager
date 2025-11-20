import api from "@/services/axiosInstance";

/** 🎓 Interface RoomAssignment */
export interface RoomAssignment {
  _id?: string;
  schedule: string; // liên kết tới ExamSchedule
  examRoom?: string; // phòng thi
  examStudent?: string; // học sinh
  sbd?: string; // số báo danh
  seatNumber?: number; // số thứ tự trong phòng
}

/** 🧩 API Quản lý xếp phòng thi */
export const roomAssignmentApi = {
  /** 🤖 Tự động xếp phòng cho 1 lịch thi */
  async autoAssign(scheduleId: string, data?: any) {
    const res = await api.post(`/room-assignments/auto/${scheduleId}`, data);
    return res.data;
  },

  /** 📋 Lấy danh sách học sinh đã xếp chỗ theo lịch thi */
  async getBySchedule(scheduleId: string) {
    const res = await api.get(`/room-assignments/${scheduleId}`);
    return res.data;
  },

  /** ✏️ Cập nhật chỗ ngồi */
  async update(id: string, data: Partial<RoomAssignment>) {
    const res = await api.put(`/room-assignments/${id}`, data);
    return res.data;
  },

  /** 🗑️ Reset toàn bộ danh sách xếp phòng cho 1 lịch thi */
  async reset(scheduleId: string) {
    const res = await api.delete(`/room-assignments/reset/${scheduleId}`);
    return res.data;
  },

  /** 🧾 Xuất danh sách PDF */
  async exportPdf(scheduleId: string) {
    const res = await api.get(`/room-assignments/export/${scheduleId}/pdf`, {
      responseType: "blob",
    });
    return res.data;
  },

  /** 🛠️ Gán thủ công học sinh vào phòng thi */
  async manualAssign(roomId: string, studentIds: string[]) {
    const res = await api.post("/room-assignments/manual", {
      roomId,
      studentIds,
    });
    return res.data;
  },
};

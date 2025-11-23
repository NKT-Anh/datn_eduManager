import api from "./axiosInstance";

export const gradeApi = {
  // 🔹 Lấy danh sách khối
  async getAll() {
    try {
      const res = await api.get("/grade");
      return res.data;
    } catch (err) {
      console.error("Lỗi khi lấy danh sách khối:", err);
      throw err.response?.data || err.message;
    }
  },

  // 🔹 Thêm mới khối
  async create(data) {
    try {
      const res = await api.post("/grade", data);
      return res.data;
    } catch (err) {
      console.error("Lỗi khi thêm khối:", err);
      throw err.response?.data || err.message;
    }
  },

  // 🔹 Cập nhật khối
  async update(id, data) {
    try {
      const res = await api.put(`/grade/${id}`, data);
      return res.data;
    } catch (err) {
      console.error("Lỗi khi cập nhật khối:", err);
      throw err.response?.data || err.message;
    }
  },

  // 🔹 Xóa khối
  async delete(id) {
    try {
      const res = await api.delete(`/grade/${id}`);
      return res.data;
    } catch (err) {
      console.error("Lỗi khi xóa khối:", err);
      throw err.response?.data || err.message;
    }
  },
};
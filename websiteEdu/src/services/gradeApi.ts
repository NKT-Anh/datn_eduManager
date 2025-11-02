import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_URL = `${BASE_URL}/grade`;

export const gradeApi = {
  // 🔹 Lấy danh sách khối
  async getAll() {
    try {
      const res = await axios.get(API_URL);
      return res.data;
    } catch (err) {
      console.error("Lỗi khi lấy danh sách khối:", err);
      throw err.response?.data || err.message;
    }
  },

  // 🔹 Thêm mới khối
  async create(data) {
    try {
      const res = await axios.post(API_URL, data);
      return res.data;
    } catch (err) {
      console.error("Lỗi khi thêm khối:", err);
      throw err.response?.data || err.message;
    }
  },

  // 🔹 Cập nhật khối
  async update(id, data) {
    try {
      const res = await axios.put(`${API_URL}/${id}`, data);
      return res.data;
    } catch (err) {
      console.error("Lỗi khi cập nhật khối:", err);
      throw err.response?.data || err.message;
    }
  },

  // 🔹 Xóa khối
  async delete(id) {
    try {
      const res = await axios.delete(`${API_URL}/${id}`);
      return res.data;
    } catch (err) {
      console.error("Lỗi khi xóa khối:", err);
      throw err.response?.data || err.message;
    }
  },
};
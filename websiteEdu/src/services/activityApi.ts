// api/activity.ts
import axios from "axios";
import { Activity, ActivityInput } from "@/types/class";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const BASE_URL = `${API_BASE}/activities`;

export const activityApi = {
  // 🟢 Lấy tất cả hoạt động
  getAll: async (): Promise<Activity[]> => {
    const res = await axios.get(BASE_URL);
    return res.data;
  },

  // 🟢 Lấy tất cả hoạt động (alias)
  getActivities: async (): Promise<Activity[]> => {
    const res = await axios.get(BASE_URL);
    return res.data;
  },

  // 🟢 Lấy 1 hoạt động theo ID
  getById: async (id: string): Promise<Activity> => {
    const res = await axios.get(`${BASE_URL}/${id}`);
    return res.data;
  },

  // 🟢 Tạo mới hoạt động
  create: async (data: ActivityInput): Promise<Activity> => {
    const res = await axios.post(BASE_URL, data);
    return res.data;
  },

  // 🟢 Tạo mới hoạt động (alias)
  createActivity: async (data: ActivityInput): Promise<Activity> => {
    const res = await axios.post(BASE_URL, data);
    return res.data;
  },

  // 🟢 Cập nhật hoạt động
  update: async (id: string, data: ActivityInput): Promise<Activity> => {
    const res = await axios.put(`${BASE_URL}/${id}`, data);
    return res.data;
  },

  // 🟢 Xóa hoạt động
  delete: async (id: string): Promise<void> => {
    await axios.delete(`${BASE_URL}/${id}`);
  },
};

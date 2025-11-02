// src/api/subjectApi.ts
import { Subject, SubjectInput, SubjectDetailResponse } from '@/types/class';
import axiosClient from './axiosInstance';

const BASE_URL = '/subjects'; // axiosClient đã có baseURL rồi

export const subjectApi = {
  // 📘 Lấy danh sách tất cả môn học
  getSubjects: async (): Promise<Subject[]> => {
    const res = await axiosClient.get(BASE_URL);
    return res.data;
  },

  // 🔍 Lấy chi tiết 1 môn học theo ID
  getSubjectById: async (id: string): Promise<Subject> => {
    const res = await axiosClient.get(`${BASE_URL}/${id}`);
    return res.data;
  },

  // ➕ Tạo môn học mới
  create: async (data: SubjectInput): Promise<Subject> => {
    const res = await axiosClient.post(BASE_URL, data);
    return res.data;
  },

  // ✏️ Cập nhật môn học
  update: async (id: string, data: SubjectInput): Promise<Subject> => {
    const res = await axiosClient.put(`${BASE_URL}/${id}`, data);
    return res.data;
  },

  // ❌ Xóa môn học
  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`${BASE_URL}/${id}`);
  },

  // 🧩 Lấy chi tiết (alias của getSubjectById)
  getDetail: async (id: string): Promise<SubjectDetailResponse> => {
    const res = await axiosClient.get<SubjectDetailResponse>(`${BASE_URL}/${id}`);
    return res.data;
  },

  // ⚙️ Cập nhật việc tính điểm trung bình (includeInAverage)
  updateIncludeInAverage: async (subjectId: string, includeInAverage: boolean) => {
    const res = await axiosClient.put(`${BASE_URL}/${subjectId}/include-average`, { includeInAverage });
    return res.data;
  },
};

export default subjectApi;

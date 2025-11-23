import axiosClient from './axiosInstance';

const conductApi = {
  // ✅ Lấy danh sách hạnh kiểm
  getConducts: async (params?: {
    year?: string;
    semester?: string;
    classId?: string;
    studentId?: string;
  }) => {
    const res = await axiosClient.get('/conducts', { params });
    return res.data;
  },

  // ✅ Lấy chi tiết hạnh kiểm
  getConductById: async (id: string) => {
    const res = await axiosClient.get(`/conducts/${id}`);
    return res.data;
  },

  // ✅ Cập nhật hạnh kiểm (GVCN nhập, Admin sửa)
  updateConduct: async (id: string, payload: {
    conduct?: string;
    gpa?: number;
    rank?: number;
    note?: string;
  }) => {
    const res = await axiosClient.put(`/conducts/${id}`, payload);
    return res.data;
  },

  // ✅ Tạo hạnh kiểm (Chỉ Admin)
  createConduct: async (payload: {
    studentId: string;
    classId: string;
    year: string;
    semester: string;
    conduct?: string;
    gpa?: number;
    rank?: number;
    note?: string;
  }) => {
    const res = await axiosClient.post('/conducts', payload);
    return res.data;
  },
};

// ✅ API cho cấu hình hạnh kiểm
export const conductConfigApi = {
  // Lấy danh sách cấu hình
  getConductConfigs: async (params?: { schoolYear?: string }) => {
    const res = await axiosClient.get('/conduct-config', { params });
    return res.data;
  },

  // Lấy chi tiết cấu hình
  getConductConfigById: async (id: string) => {
    const res = await axiosClient.get(`/conduct-config/${id}`);
    return res.data;
  },

  // Tạo cấu hình
  createConductConfig: async (payload: any) => {
    const res = await axiosClient.post('/conduct-config', payload);
    return res.data;
  },

  // Cập nhật cấu hình
  updateConductConfig: async (id: string, payload: any) => {
    const res = await axiosClient.put(`/conduct-config/${id}`, payload);
    return res.data;
  },

  // Xóa cấu hình
  deleteConductConfig: async (id: string) => {
    const res = await axiosClient.delete(`/conduct-config/${id}`);
    return res.data;
  },

  // Tính toán hạnh kiểm tự động (Batch)
  calculateConducts: async (payload: {
    schoolYear: string;
    semester: string;
    classId?: string;
    studentIds?: string[];
  }) => {
    const res = await axiosClient.post('/conduct-config/calculate', payload);
    return res.data;
  },
};

export default conductApi;


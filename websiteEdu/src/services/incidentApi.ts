import axiosClient from './axiosInstance';

const incidentApi = {
  // 📋 Lấy danh sách sự cố/vi phạm
  getIncidents: async (params?: {
    status?: string;
    type?: string;
    classId?: string;
    studentId?: string;
  }) => {
    const res = await axiosClient.get('/incidents', { params });
    return res.data;
  },

  // 📋 Lấy chi tiết sự cố
  getIncidentById: async (id: string) => {
    const res = await axiosClient.get(`/incidents/${id}`);
    return res.data;
  },

  // ➕ Tạo sự cố (Học sinh gửi báo cáo)
  createIncident: async (payload: {
    title: string;
    description: string;
    type?: 'discipline' | 'academic' | 'safety' | 'other';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    classId?: string;
    studentId?: string;
  }) => {
    const res = await axiosClient.post('/incidents', payload);
    return res.data;
  },

  // ✏️ Cập nhật sự cố
  updateIncident: async (id: string, payload: {
    title?: string;
    description?: string;
    type?: string;
    severity?: string;
    status?: 'reported' | 'investigating' | 'resolved' | 'closed';
    resolution?: string;
    handledBy?: string;
  }) => {
    const res = await axiosClient.put(`/incidents/${id}`, payload);
    return res.data;
  },

  // 🗑️ Xóa sự cố (Chỉ Admin)
  deleteIncident: async (id: string) => {
    const res = await axiosClient.delete(`/incidents/${id}`);
    return res.data;
  },
};

export default incidentApi;


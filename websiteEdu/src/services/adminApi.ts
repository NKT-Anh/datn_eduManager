import api from './axiosInstance';

// ✅ API cho quản lý Admin và Thùng rác
export const adminApi = {
  // Quản lý Admin
  getAllAdmins: () => api.get('/admin'),
  getAdminById: (id: string) => api.get(`/admin/${id}`),
  createAdmin: (data: any) => api.post('/admin', data),
  updateAdmin: (id: string, data: any) => api.put(`/admin/${id}`, data),
  deleteAdmin: (id: string) => api.delete(`/admin/${id}`),

  // Thùng rác (Trash) - Soft Delete
  getTrashData: (params?: any) => api.get('/admin/trash', { params }),
  restoreMultiple: (items: any[]) => api.post('/admin/trash/restore', { items }),
  forceDeleteMultiple: (items: any[]) => api.delete('/admin/trash/force-delete', { data: { items } }),
};

export default adminApi;

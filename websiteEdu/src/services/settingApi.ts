import axiosClient from './axiosInstance';

const settingApi = {
  // Lấy toàn bộ cấu hình hệ thống
  getSettings: async () => {
    const res = await axiosClient.get('/settings');
    return res.data;
  },

  // Cập nhật cấu hình
  updateSettings: async (payload: any) => {
    const res = await axiosClient.put('/settings', payload);
    return res.data;
  },

  // Reset về mặc định
  resetSettings: async () => {
    const res = await axiosClient.post('/settings/reset');
    return res.data;
  },

  // Test gửi email (SMTP)
  testEmail: async (payload: any) => {
    const res = await axiosClient.post('/settings/test-email', payload);
    return res.data;
  },

  sendTestEmail: async (email: string) => {
    const res = await axiosClient.post('/settings/send-test-email', { to: email });
    return res.data;
  },

  // Gửi email hàng loạt
  sendBulkEmail: async (payload: {
    recipientType: 'teachers' | 'students' | 'all' | 'single';
    subject: string;
    content: string;
    fromEmail?: string;
    fromName?: string;
    singleRecipientEmail?: string;
  }) => {
    const res = await axiosClient.post('/settings/send-bulk-email', payload);
    return res.data;
  },

  // ✅ Lấy lịch sử email
  getEmailLogs: async (params?: {
    page?: number;
    limit?: number;
    senderId?: string;
    recipientType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) => {
    const res = await axiosClient.get('/email-logs', { params });
    return res.data;
  },

  // ✅ Lấy thống kê email
  getEmailStats: async (params?: {
    startDate?: string;
    endDate?: string;
    schoolYear?: string;
  }) => {
    const res = await axiosClient.get('/email-logs/stats', { params });
    return res.data;
  },

  // ✅ Lấy chi tiết 1 email log (chỉ Admin)
  getEmailLogById: async (id: string) => {
    const res = await axiosClient.get(`/email-logs/${id}`);
    return res.data;
  },

  // ✅ Lấy thông tin công khai của trường (public, không cần auth)
  getPublicSchoolInfo: async (): Promise<{
    schoolName: string;
    slogan: string;
    description: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    facebook: string;
  }> => {
    const res = await axiosClient.get('/settings/public');
    return res.data;
  },
};

export default settingApi;

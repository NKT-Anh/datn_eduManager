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
};

export default settingApi;

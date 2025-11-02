import axiosClient from './axiosInstance';

const gradeConfigApi = {
  // ✅ Lấy cấu hình tính điểm hiện tại
  getConfig: async () => {
    const res = await axiosClient.get('/grade-config');
    return res.data;
  },

  // ✅ Cập nhật cấu hình tính điểm (weights, rounding)
  updateConfig: async (payload: {
    weights: Record<string, number>;
    rounding: 'half-up' | 'none';
  }) => {
    const res = await axiosClient.put('/grade-config', payload);
    return res.data;
  },

  // ✅ Reset về cấu hình mặc định
  resetConfig: async () => {
    const res = await axiosClient.post('/grade-config/reset');
    return res.data;
  },
};

export default gradeConfigApi;

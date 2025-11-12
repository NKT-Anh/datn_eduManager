import axiosClient from './axiosInstance';

const gradeConfigApi = {
  // ✅ Lấy cấu hình tính điểm hiện tại
  getConfig: async (params?: { schoolYear?: string; semester?: string }) => {
    const res = await axiosClient.get('/grade-config', { params });
    return res.data;
  },

  // ✅ Cập nhật hoặc tạo cấu hình tính điểm (weights, rounding, schoolYear, semester)
  updateConfig: async (payload: {
    weights: Record<string, number>;
    rounding: 'half-up' | 'none';
    schoolYear?: string;
    semester?: string;
  }) => {
    const res = await axiosClient.post('/grade-config', payload);
    return res.data;
  },

  // ✅ Reset về cấu hình mặc định (nếu backend hỗ trợ)
  resetConfig: async () => {
    // Nếu backend không có endpoint reset, chỉ return
    try {
      const res = await axiosClient.post('/grade-config/reset');
      return res.data;
    } catch {
      // Nếu không có endpoint, return null
      return null;
    }
  },
};

export default gradeConfigApi;

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
    conductNote?: string;
    action?: 'save' | 'submit';
    gpa?: number;
    rank?: number;
    note?: string;
  }) => {
    const res = await axiosClient.put(`/conducts/${id}`, payload);
    return res.data;
  },

  // ✅ Tính toán đề xuất hạnh kiểm tự động
  calculateSuggested: async (params: {
    studentId: string;
    year: string;
    semester: string;
  }) => {
    const res = await axiosClient.get('/conducts/calculate-suggested', { params });
    return res.data;
  },

  // ✅ Phê duyệt hạnh kiểm (BGH)
  approveConduct: async (id: string, payload: {
    action: 'approve' | 'reject' | 'lock';
    comment?: string;
  }) => {
    const res = await axiosClient.post(`/conducts/${id}/approve`, payload);
    return res.data;
  },

  // ✅ Phê duyệt hàng loạt hạnh kiểm (BGH)
  bulkApproveConducts: async (payload: {
    action: 'approve' | 'lock';
    year?: string;
    semester?: string;
    classId?: string;
    ids?: string[];
    comment?: string;
  }) => {
    const res = await axiosClient.post('/conducts/approve/bulk', payload);
    return res.data;
  },

  // ✅ Lấy danh sách hạnh kiểm chờ phê duyệt
  getPendingConducts: async (params?: {
    year?: string;
    semester?: string;
    classId?: string;
  }) => {
    const res = await axiosClient.get('/conducts/pending/list', { params });
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

  // ✅ Cập nhật nhận xét của GVCN (HK1, HK2, Cuối năm)
  updateYearNote: async (payload: {
    studentId: string;
    year: string;
    semester: 'HK1' | 'HK2' | 'CN' | '1' | '2' | 'cuoi-nam'| 'CN';
    note: string;
  }) => {
    const res = await axiosClient.put('/conducts/year-note/update', payload);
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
};


// 📊 Lấy thống kê hạnh kiểm các lớp (class statistics)
export const getConductClassStatistics = async (params?: { year?: string; semester?: string }) => {
  const res = await axiosClient.get('/conducts/class-statistics', { params });
  return res.data;
};

// ✅ Phê duyệt hạnh kiểm cho 1 lớp
export const approveConduct = async (classId: string) => {
  const res = await axiosClient.post(`/conducts/approve/${classId}`);
  return res.data;
};

// ✅ Phê duyệt tất cả hạnh kiểm
export const approveAllConduct = async (params?: { year?: string; semester?: string }) => {
  const res = await axiosClient.post('/conducts/approve-all', params);
  return res.data;
};


// 📊 Thống kê hạnh kiểm theo khối (gốc)
export const getConductBlockStatistics = async (params?: { 
  year?: string; 
  semester?: string; 
}) => {
  const res = await axiosClient.get('/conducts/block-statistics', { params });
  return res.data;
};

// 📊 Thống kê hạnh kiểm theo từng lớp (dùng block-statistics, trả về từng lớp)
export const getConductBlockStatisticsByClass = async (params?: { year?: string; semester?: string }) => {
  const res = await axiosClient.get('/conducts/block-statistics', { params });
  const data = res.data?.data || [];
  // Mỗi khối có mảng lớp, cần chuyển thành từng lớp riêng
  // Giả sử mỗi item có: grade, classCount, studentCount, stats, completedClass, và có thể có mảng classes
  // Nếu không có mảng classes, cần backend trả về hoặc phải lấy từ nơi khác
  // Ở đây sẽ kiểm tra nếu có mảng classes, còn không thì trả về rỗng
  let classList = [];
  for (const block of data) {
    if (Array.isArray(block.classes)) {
      classList.push(...block.classes.map(cls => ({
        ...cls,
        grade: block.grade
      })));
    }
  }
  return classList;
};


export default conductApi;


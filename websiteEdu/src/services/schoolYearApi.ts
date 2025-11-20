import api from './axiosInstance';

export interface Semester {
  name: string;
  code: string;
  startDate: string;
  endDate: string;
}

export interface SchoolYear {
  _id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  semesters?: Semester[];
  isActive: boolean;
  status?: 'upcoming' | 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSchoolYearPayload {
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  semesters?: Semester[];
  isActive?: boolean;
}

export interface UpdateSchoolYearPayload {
  name?: string;
  code?: string;
  startDate?: string;
  endDate?: string;
  semesters?: Semester[];
  isActive?: boolean;
}

export const schoolYearApi = {
  /**
   * 📋 Lấy danh sách tất cả năm học
   */
  getAll: async (): Promise<SchoolYear[]> => {
    const res = await api.get('/school-years');
    return res.data.data || res.data;
  },

  /**
   * 🔍 Lấy chi tiết một năm học
   */
  getById: async (id: string): Promise<SchoolYear> => {
    const res = await api.get(`/school-years/${id}`);
    return res.data.data;
  },

  /**
   * 📊 Lấy năm học hiện tại (active)
   */
  getCurrent: async (): Promise<SchoolYear> => {
    const res = await api.get('/school-years/current');
    return res.data.data;
  },

  /**
   * ➕ Tạo năm học mới
   */
  create: async (payload: CreateSchoolYearPayload): Promise<SchoolYear> => {
    const res = await api.post('/school-years', payload);
    return res.data.data;
  },

  /**
   * ✏️ Cập nhật năm học
   */
  update: async (id: string, payload: UpdateSchoolYearPayload): Promise<SchoolYear> => {
    const res = await api.put(`/school-years/${id}`, payload);
    return res.data.data;
  },

  /**
   * ✅ Kích hoạt năm học
   */
  activate: async (id: string): Promise<SchoolYear> => {
    const res = await api.post(`/school-years/${id}/activate`);
    return res.data.data;
  },

  /**
   * 🚫 Ngừng kích hoạt năm học
   */
  deactivate: async (id: string): Promise<SchoolYear> => {
    const res = await api.post(`/school-years/${id}/deactivate`);
    return res.data.data;
  },

  /**
   * 🗑️ Xóa năm học
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/school-years/${id}`);
  },

  /**
   * 🔄 Cập nhật trạng thái năm học
   */
  updateSchoolYearStatus: async (
    id: string,
    status: 'upcoming' | 'active' | 'inactive'
  ): Promise<SchoolYear> => {
    const res = await api.patch(`/school-years/${id}/status`, {
      status,
    });
    return res.data.data;
  },

};


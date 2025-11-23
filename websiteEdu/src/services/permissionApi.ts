import api from './axiosInstance';

export interface Permission {
  _id: string;
  role: 'admin' | 'teacher' | 'student';
  schoolYear: string;
  permissions: string[];
  description?: string;
  isActive: boolean;
  createdBy?: {
    _id: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    email: string;
  };
  createdAt?: string;
  updatedAt?: string;
  isDefault?: boolean; // ✅ Nếu true, đây là quyền mặc định từ ROLE_PERMISSIONS
}

export interface PermissionInput {
  role: 'admin' | 'teacher' | 'student';
  schoolYear: string;
  permissions: string[];
  description?: string;
  isActive?: boolean;
}

export interface CopyPermissionsPayload {
  fromYear: string;
  toYear: string;
}

const BASE_URL = '/permissions';

export const permissionApi = {
  // ✅ Lấy tất cả permissions (có thể filter theo role, schoolYear, isActive)
  getAll: async (params?: {
    role?: string;
    schoolYear?: string;
    isActive?: boolean;
  }): Promise<Permission[]> => {
    const res = await api.get<Permission[]>(BASE_URL, { params });
    return res.data;
  },

  // ✅ Lấy permission theo ID
  getById: async (id: string): Promise<Permission> => {
    const res = await api.get<Permission>(`${BASE_URL}/${id}`);
    return res.data;
  },

  // ✅ Lấy permission theo role và schoolYear
  getByRoleAndYear: async (role: string, schoolYear: string): Promise<Permission> => {
    const res = await api.get<Permission>(`${BASE_URL}/role/${role}/year/${schoolYear}`);
    return res.data;
  },

  // ✅ Tạo permission mới
  create: async (data: PermissionInput): Promise<Permission> => {
    const res = await api.post<Permission>(BASE_URL, data);
    return res.data;
  },

  // ✅ Cập nhật permission
  update: async (id: string, data: Partial<PermissionInput>): Promise<Permission> => {
    const res = await api.put<Permission>(`${BASE_URL}/${id}`, data);
    return res.data;
  },

  // ✅ Xóa permission
  delete: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`${BASE_URL}/${id}`);
    return res.data;
  },

  // ✅ Sao chép permissions từ năm học này sang năm học khác
  copyFromYear: async (payload: CopyPermissionsPayload): Promise<{
    message: string;
    copied: number;
    errors?: string[];
  }> => {
    const res = await api.post<{
      message: string;
      copied: number;
      errors?: string[];
    }>(`${BASE_URL}/copy`, payload);
    return res.data;
  },
};





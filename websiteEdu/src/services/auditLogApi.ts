import api from "./axiosInstance";

export interface AuditLog {
  _id: string;
  userId: string | { _id: string; name: string; email: string };
  userRole: 'admin' | 'teacher' | 'student' | 'bgh';
  userName: string;
  userFlags?: {
    isHomeroom?: boolean;
    isDepartmentHead?: boolean;
    isLeader?: boolean;
    permissions?: string[];
    currentYear?: string;
    currentHomeroomClassId?: string;
  };
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'IMPORT' | 'APPROVE' | 'REJECT' | 'LOCK' | 'UNLOCK' | 'RESET_PASSWORD' | 'CHANGE_PASSWORD';
  resource: 'USER' | 'STUDENT' | 'TEACHER' | 'CLASS' | 'SUBJECT' | 'GRADE' | 'EXAM' | 'ATTENDANCE' | 'TEACHING_ASSIGNMENT' | 'SCHOOL_YEAR' | 'PERMISSION' | 'NOTIFICATION' | 'SYSTEM';
  resourceId?: string;
  resourceName?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  userRole?: string;
  action?: string;
  resource?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface AuditLogResponse {
  success: boolean;
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogStats {
  totalLogs: number;
  actionStats: Array<{ _id: string; count: number }>;
  resourceStats: Array<{ _id: string; count: number }>;
  roleStats: Array<{ _id: string; count: number }>;
  statusStats: Array<{ _id: string; count: number }>;
  topUsers: Array<{ _id: string; userName: string; userRole: string; count: number }>;
}

const API_URL = `/audit-logs`;

export const auditLogApi = {
  getAll: async (filters?: AuditLogFilters): Promise<AuditLogResponse> => {
    const res = await api.get(API_URL, { params: filters });
    return res.data;
  },

  getById: async (id: string): Promise<{ success: boolean; data: AuditLog }> => {
    const res = await api.get(`${API_URL}/${id}`);
    return res.data;
  },

  getStats: async (params?: { startDate?: string; endDate?: string }): Promise<{ success: boolean; data: AuditLogStats }> => {
    const res = await api.get(`${API_URL}/stats`, { params });
    return res.data;
  },

  deleteOldLogs: async (days?: number): Promise<{ success: boolean; message: string; deletedCount: number }> => {
    const res = await api.delete(API_URL, { params: { days } });
    return res.data;
  },
};


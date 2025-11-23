import api from "./axiosInstance";

const BASE = "/department-management";

export interface DepartmentDashboard {
  department: {
    _id: string;
    name: string;
    code: string;
  };
  stats: {
    teachers: {
      total: number;
      homeroom: number;
      regular: number;
    };
    subjects: {
      total: number;
    };
    assignments: {
      totalAssignments: number;
      uniqueTeachers: number;
      uniqueClasses: number;
      uniqueSubjects: number;
    } | null;
    proposals: {
      pending: number;
      approved: number;
      rejected: number;
      applied: number;
    };
  };
}

export interface DepartmentTeacher {
  _id: string;
  name: string;
  teacherCode?: string;
  phone?: string;
  subjects?: Array<{
    subjectId: {
      _id: string;
      name: string;
      code?: string;
    };
    grades: string[];
  }>;
  mainSubject?: {
    _id: string;
    name: string;
    code?: string;
  };
  isHomeroom: boolean;
  isDepartmentHead: boolean;
  departmentId?: {
    _id: string;
    name: string;
    code?: string;
  };
  currentHomeroomClassId?: string;
  assignmentInfo?: {
    totalClasses: number;
    assignments: Array<{
      subject: string;
      class: string;
      grade: string;
    }>;
  };
}

export interface DepartmentTeachersResponse {
  department: {
    _id: string;
    name: string;
    code: string;
  };
  teachers: DepartmentTeacher[];
}

export interface CreateProposalPayload {
  teacherId: string;
  subjectId: string;
  classId: string;
  year: string;
  semester: "1" | "2";
  notes?: string;
}

export interface Proposal {
  _id: string;
  teacherId: {
    _id: string;
    name: string;
    teacherCode?: string;
  };
  subjectId: {
    _id: string;
    name: string;
    code?: string;
  };
  classId: {
    _id: string;
    className: string;
    classCode?: string;
    grade: string;
  };
  year: string;
  semester: "1" | "2";
  status: "pending" | "approved" | "rejected" | "applied" | "cancelled";
  proposedBy: {
    _id: string;
    name: string;
    teacherCode?: string;
  };
  departmentId: {
    _id: string;
    name: string;
    code?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalsResponse {
  department: {
    _id: string;
    name: string;
  };
  proposals: Proposal[];
}

export const departmentManagementApi = {
  // ✅ Dashboard quản lý bộ môn
  getDashboard: async (params?: { year?: string; semester?: string }): Promise<DepartmentDashboard> => {
    const res = await api.get<DepartmentDashboard>(`${BASE}/dashboard`, { params });
    return res.data;
  },

  // ✅ Lấy danh sách giáo viên trong tổ
  getTeachers: async (params?: { year?: string; semester?: string }): Promise<DepartmentTeachersResponse> => {
    const res = await api.get<DepartmentTeachersResponse>(`${BASE}/teachers`, { params });
    return res.data;
  },

  // ✅ Thêm giáo viên vào tổ
  addTeacher: async (teacherId: string): Promise<{ message: string; teacher: any }> => {
    const res = await api.post(`${BASE}/teachers`, { teacherId });
    return res.data;
  },

  // ✅ Xóa giáo viên khỏi tổ
  removeTeacher: async (teacherId: string): Promise<{ message: string; teacher: any }> => {
    const res = await api.delete(`${BASE}/teachers/${teacherId}`);
    return res.data;
  },

  // ✅ Lấy danh sách đề xuất phân công
  getProposals: async (params?: { status?: string; year?: string; semester?: string }): Promise<ProposalsResponse> => {
    const res = await api.get<ProposalsResponse>(`${BASE}/proposals`, { params });
    return res.data;
  },

  // ✅ Tạo đề xuất phân công
  createProposal: async (payload: CreateProposalPayload): Promise<{ message: string; proposal: Proposal }> => {
    const res = await api.post(`${BASE}/proposals`, payload);
    return res.data;
  },

  // ✅ Hủy đề xuất phân công
  cancelProposal: async (id: string): Promise<{ message: string }> => {
    const res = await api.put(`${BASE}/proposals/${id}/cancel`);
    return res.data;
  },

  // ✅ Hủy toàn bộ đề xuất
  cancelAllProposals: async (payload: {
    year?: string;
    semester?: "1" | "2";
    status?: string;
  }): Promise<{ message: string; cancelledCount: number }> => {
    const res = await api.put(`${BASE}/proposals/cancel-all`, payload);
    return res.data;
  },

  // ✅ Tạo nhiều đề xuất phân công cùng lúc (batch)
  createBatchProposals: async (payload: {
    proposals: Array<{ teacherId: string; subjectId: string; classIds: string[] }>;
    year: string;
    semester: "1" | "2";
    notes?: string;
  }): Promise<{ message: string; results: any }> => {
    const res = await api.post(`${BASE}/proposals/batch`, payload);
    return res.data;
  },

  // ✅ Lấy số tiết/tuần của môn học trong các lớp
  getClassPeriods: async (params: {
    year: string;
    semester: "1" | "2";
    subjectId: string;
    classIds: string[];
  }): Promise<{ periods: Record<string, number> }> => {
    const res = await api.get(`${BASE}/class-periods`, {
      params: {
        ...params,
        classIds: params.classIds.join(',')
      }
    });
    return res.data;
  },
};


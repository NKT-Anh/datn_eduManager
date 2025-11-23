import api from "./axiosInstance";

const API_URL = "/teachingAssignmentProposals";

export interface TeachingAssignmentProposal {
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
    year?: string;
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
  approvedBy?: {
    _id: string;
    name: string;
    email?: string;
  };
  approvedAt?: string;
  rejectionReason?: string;
  notes?: string;
  appliedAt?: string;
  teachingAssignmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalPayload {
  teacherId: string;
  subjectId: string;
  classId: string;
  year: string;
  semester: "1" | "2";
  notes?: string;
}

export interface PreviewProposalResponse {
  message: string;
  preview: Array<{
    proposalId: string;
    proposal: any;
    current: any;
    changeType: "new_assignment" | "teacher_changed" | "no_change";
    canApply: boolean;
    validationError?: string;
  }>;
  summary: {
    total: number;
    newAssignments: number;
    teacherChanges: number;
    canApply: number;
    cannotApply: number;
  };
}

export interface ApplyProposalsPayload {
  proposalIds: string[];
  replaceExisting?: boolean;
}

export const proposalApi = {
  // ✅ Lấy danh sách proposal
  getAll: async (params?: { year?: string; semester?: string; status?: string; departmentId?: string }) => {
    const response = await api.get(API_URL, { params });
    return response.data as TeachingAssignmentProposal[];
  },

  // ✅ Tạo proposal (trưởng bộ môn)
  create: async (payload: CreateProposalPayload) => {
    const response = await api.post(API_URL, payload);
    return response.data;
  },

  // ✅ Duyệt proposal (Admin/BGH)
  approve: async (id: string, notes?: string) => {
    const response = await api.put(`${API_URL}/${id}/approve`, { notes });
    return response.data;
  },

  // ✅ Từ chối proposal (Admin/BGH)
  reject: async (id: string, rejectionReason: string) => {
    const response = await api.put(`${API_URL}/${id}/reject`, { rejectionReason });
    return response.data;
  },

  // ✅ Xem trước proposal
  preview: async (proposalIds: string[]) => {
    const response = await api.post(`${API_URL}/preview`, { proposalIds });
    return response.data as PreviewProposalResponse;
  },

  // ✅ Áp dụng proposal (Admin/BGH)
  apply: async (payload: ApplyProposalsPayload) => {
    const response = await api.post(`${API_URL}/apply`, payload);
    return response.data;
  },

  // ✅ Hủy proposal (trưởng bộ môn)
  cancel: async (id: string) => {
    const response = await api.put(`${API_URL}/${id}/cancel`);
    return response.data;
  },
};


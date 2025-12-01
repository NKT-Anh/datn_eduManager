import api from "./axiosInstance";
import { TeachingAssignment, TeachingAssignmentPayload } from "@/types/class";

const API_URL = `/teachingAssignments`;

export const assignmentApi = {
  getAll: async (params?: { year?: string }): Promise<TeachingAssignment[]> => {
    const queryParams: any = { isDeleted: 'false' };
    if (params?.year) queryParams.year = params.year;
    const res = await api.get(API_URL, { params: queryParams });
    return res.data;
  },
  getById: async (id: string): Promise<TeachingAssignment> => {
    const res = await api.get(`${API_URL}/${id}`);
    return res.data;
  },
  create: async (data: TeachingAssignmentPayload): Promise<TeachingAssignment> => {
    const res = await api.post(API_URL, data);
    return res.data;
  },
  update: async (id: string, data: TeachingAssignmentPayload): Promise<TeachingAssignment> => {
    const res = await api.put(`${API_URL}/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${API_URL}/${id}`);
  },
  createBulk: async (data: TeachingAssignmentPayload[]): Promise<TeachingAssignment[]> => {
    const res = await api.post(`${API_URL}/bulk`, data);
    return res.data;
  },

  // 🆕 Lấy phân công theo giáo viên
  getByTeacher: async (
    teacherId: string,
    params?: { year?: string; semester?: string }
  ): Promise<TeachingAssignment[]> => {
    const queryParams: any = {};
    if (params?.year) queryParams.year = params.year;
    if (params?.semester) queryParams.semester = params.semester;

    const res = await api.get(`${API_URL}/teacher/${teacherId}`, { params: queryParams });
    return res.data;
  },

  // ✅ Kiểm tra môn học thiếu giáo viên
  checkMissingTeachers: async (params: {
    year: string;
    semester: string;
    grade?: string;
  }): Promise<{
    message: string;
    missingAssignments: Array<{
      classId: string;
      className: string;
      classCode: string;
      grade: string;
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      requiredPeriods: number;
      assignedPeriods: number;
      status: string;
      teacherId: null;
      teacherName: null;
    }>;
    summary: {
      totalClasses: number;
      totalMissing: number;
      bySubject: Array<{
        subjectId: string;
        subjectName: string;
        subjectCode: string;
        totalRequiredPeriods: number;
        totalAssignedPeriods: number;
        missingClassesCount: number;
        missingClasses: Array<{
          classId: string;
          className: string;
          requiredPeriods: number;
        }>;
      }>;
    };
    filters: {
      year: string;
      semester: string;
      grade: string;
    };
  }> => {
    const res = await api.get(`${API_URL}/check-missing`, { params });
    return res.data;
  },

  // ✅ Phân công tự động
  autoAssign: async (params: {
    year: string;
    semester: "1" | "2";
    grades: string[];
    shouldDeleteOld?: boolean;
    shouldSupplement?: boolean;
  }): Promise<{
    message: string;
    createdCount: number;
    assignments: TeachingAssignment[];
  }> => {
    const res = await api.post(`${API_URL}/auto-assign`, params);
    return res.data;
  },

  // ✅ Kiểm tra số lượng điểm của phân công
  getGradeCount: async (id: string): Promise<{ gradeCount: number; locked: boolean }> => {
    const res = await api.get(`${API_URL}/${id}/grade-count`);
    return res.data;
  },

  // ✅ Kiểm tra trạng thái khóa
  getLockStatus: async (params: {
    year: string;
    semester: string;
  }): Promise<{
    isLocked: boolean;
    lockedAt?: string;
    lockedBy?: string;
    lockedByInfo?: { name: string; email: string };
    year: string;
    semester: string;
  }> => {
    const res = await api.get(`${API_URL}/lock-status`, { params });
    return res.data;
  },

  // ✅ Khóa danh sách phân công
  lock: async (params: {
    year: string;
    semester: string;
  }): Promise<{ message: string; lockedCount: number }> => {
    const res = await api.post(`${API_URL}/lock`, params);
    return res.data;
  },

  // ✅ Mở khóa danh sách phân công
  unlock: async (params: {
    year: string;
    semester: string;
  }): Promise<{ message: string; unlockedCount: number }> => {
    const res = await api.post(`${API_URL}/unlock`, params);
    return res.data;
  },

  // ✅ Công bố phân công giảng dạy
  publish: async (params: {
    year: string;
    semester: string;
  }): Promise<{ message: string; publishedCount: number }> => {
    const res = await api.post(`${API_URL}/publish`, params);
    return res.data;
  },

};

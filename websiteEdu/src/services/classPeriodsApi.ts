import api from "./axiosInstance";

export interface ClassPeriodsItem {
  year: string;
  semester: string;
  grade: string;
  classId: string;
  subjectPeriods: Record<string, number>;
  activityPeriods: Record<string, number>;
}

export interface BulkUpsertPayload {
  year: string;
  semester: string;
  grade: string;
  classPeriodsList: Array<{
    classId: string;
    subjectPeriods: Record<string, number>;
    activityPeriods: Record<string, number>;
  }>;
}

export const classPeriodsApi = {
  // ✅ Lấy phân bổ số tiết
  getClassPeriods: async (params: {
    year?: string;
    semester?: string;
    grade?: string;
    classId?: string;
  }): Promise<ClassPeriodsItem[]> => {
    const res = await api.get("/classPeriods", { params });
    return res.data;
  },

  // ✅ Lưu phân bổ số tiết cho một lớp
  upsertClassPeriods: async (payload: ClassPeriodsItem): Promise<any> => {
    const res = await api.post("/classPeriods", payload);
    return res.data;
  },

  // ✅ Bulk upsert (lưu nhiều lớp cùng lúc)
  bulkUpsertClassPeriods: async (payload: BulkUpsertPayload): Promise<any> => {
    const res = await api.post("/classPeriods/bulk", payload);
    return res.data;
  },

  // ✅ Xóa phân bổ số tiết
  deleteClassPeriods: async (id: string): Promise<any> => {
    const res = await api.delete(`/classPeriods/${id}`);
    return res.data;
  },

  // ✅ Xuất file Excel phân bổ số tiết (3 tab cho 3 khối)
  exportToExcel: async (params: {
    year: string;
    semester: string;
  }): Promise<Blob> => {
    const res = await api.get("/classPeriods/export/excel", {
      params,
      responseType: "blob", // Quan trọng: phải set responseType là blob để nhận file
    });
    return res.data;
  },

  // ✅ Tính số giáo viên tự động dựa trên ClassPeriods
  calculateRequiredTeachers: async (params: {
    year: string;
    weeklyLessons?: number;
    homeroomReduction?: number; // Số tiết trừ cho GVCN
    departmentHeadReduction?: number; // Số tiết trừ cho Tổ trưởng
  }): Promise<{
    year: string;
    weeklyLessons: number;
    totalTeachersNeeded: number;
    subjects: Array<{
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      totalPeriods: number;
      periodsPerClassPerWeek: number;
      classCount: number;
      maxClassesPerTeacher: number;
      weeklyLessons: number;
      teachersByWeeklyLessons: number;
      teachersByMaxClasses: number;
      teachersNeeded: number;
      note?: string;
    }>;
    roles?: {
      homeroomTeachers: {
        count: number;
        weeklyLessons: number;
        reduction: number;
        note: string;
      };
      departmentHeads: {
        count: number;
        weeklyLessons: number;
        reduction: number;
        note: string;
      };
    };
    summary: {
      totalSubjects: number;
      totalPeriods: number;
      averageTeachersPerSubject: string;
      totalClasses?: number;
      regulations?: Record<string, string>;
      reductions?: {
        homeroomReduction: number;
        departmentHeadReduction: number;
      };
    };
  }> => {
    const res = await api.get("/classPeriods/calculate-teachers", { params });
    return res.data;
  },
};


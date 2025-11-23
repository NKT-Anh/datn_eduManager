import axiosClient from './axiosInstance';

const gradesApi = {
  // ✅ Lưu điểm nhiều học sinh cùng lúc
  saveScores: async (payload: {
    classId: string;
    subjectId: string;
    schoolYear: string;
    semester: string;
    // Accept either the new normalized shape or the older flat-shape per student
    scores: Array<
      | {
          studentId: string;
          components: { component: string; score: number; [k: string]: any }[];
        }
      | {
          studentId: string;
          oral?: number;
          quiz15?: number;
          quiz45?: number;
          midterm?: number;
          final?: number;
        }
    >;
  }) => {
    // Normalize scores: backend expects scores: [{ studentId, components: [{ component, score, ... }] }]
    const normalized = { ...payload, scores: [] as any[] };

    const keyToComponent = {
      oral: 'oral',
      quiz15: 'quiz15',
      quiz45: 'quiz45',
      midterm: 'midterm',
      final: 'final',
    } as Record<string, string>;

    for (const s of payload.scores || []) {
      if (s && Array.isArray((s as any).components)) {
        normalized.scores.push(s);
        continue;
      }
      const studentId = (s as any).studentId;
      const comps: any[] = [];
      for (const key of Object.keys(keyToComponent)) {
        if (typeof (s as any)[key] === 'number' && !isNaN((s as any)[key])) {
          comps.push({ component: keyToComponent[key], score: (s as any)[key] });
        }
      }
      normalized.scores.push({ studentId, components: comps });
    }

    const res = await axiosClient.post('/grades/save', normalized);
    return res.data;
  },

  // ✅ Thêm hoặc cập nhật điểm cho học sinh (1 học sinh hoặc 1 cột)
  upsertGradeItem: async (payload: any) => {
    const res = await axiosClient.post('/grades/items', payload);
    return res.data;
  },

  // ✅ Xóa tất cả điểm của một component cho học sinh
  deleteGradeItems: async (params: {
    studentId: string;
    subjectId: string;
    component: string;
    classId?: string;
    schoolYear: string;
    semester: string;
  }) => {
    const res = await axiosClient.delete('/grades/items', { params });
    return res.data;
  },

  // ✅ Lưu mảng điểm cho một component
  upsertGradeItems: async (payload: {
    studentId: string;
    subjectId: string;
    component: string;
    scores: number[];
    classId?: string;
    schoolYear: string;
    semester: string;
  }) => {
    const res = await axiosClient.post('/grades/items/bulk', payload);
    return res.data;
  },

  // ✅ Lấy danh sách điểm trung bình của lớp theo môn học
  getClassSubjectSummary: async (params: {
    classId: string;
    subjectId: string;
    schoolYear: string;
    semester: string;
  }) => {
    const res = await axiosClient.get('/grades/summary', { params });
    return res.data;
  },

  // ✅ Tính lại điểm trung bình của một học sinh trong môn học
  recomputeSummary: async (payload: {
    studentId: string;
    subjectId: string;
    classId: string;
    schoolYear: string;
    semester: string;
  }) => {
    const res = await axiosClient.post('/grades/recompute', payload);
    return res.data;
  },
  initGradeTable : async (payload: {
  gradeLevel?: string;
  schoolYear: string;
  semester: string;
  classId?: string; // Tùy chọn: nếu có thì chỉ khởi tạo cho lớp đó
}) => {
  const res = await axiosClient.post(('/grades/init'),payload)
  return res.data;
},

  // ✅ Học sinh xem điểm của bản thân
  getStudentGrades: async (params?: {
    studentId?: string;
    schoolYear?: string;
    semester?: string;
  }) => {
    const res = await axiosClient.get('/grades/student', { params });
    return res.data;
  },

  // ✅ Admin/BGH xem tất cả điểm của tất cả học sinh
  getAllStudentsGrades: async (params?: {
    schoolYear?: string;
    semester?: string;
    classId?: string;
    subjectId?: string;
    grade?: string;
    keyword?: string;
  }) => {
    const res = await axiosClient.get('/grades/admin/all', { params });
    return res.data;
  },

  // ✅ Thống kê điểm theo lớp/khối/năm học
  getStatistics: async (params?: {
    schoolYear?: string;
    semester?: string;
    classId?: string;
    grade?: string;
  }) => {
    const res = await axiosClient.get('/grades/admin/statistics', { params });
    return res.data;
  },

  // ✅ Lịch sử nhập/sửa điểm
  getAuditLog: async (params?: {
    studentId?: string;
    subjectId?: string;
    classId?: string;
    schoolYear?: string;
    semester?: string;
    limit?: number;
  }) => {
    const res = await axiosClient.get('/grades/admin/audit-log', { params });
    return res.data;
  },

  // ✅ Admin cập nhật điểm
  updateGradeItem: async (id: string, payload: { score?: number; notes?: string }) => {
    const res = await axiosClient.put(`/grades/admin/item/${id}`, payload);
    return res.data;
  },

  // ✅ Admin xóa điểm
  deleteGradeItem: async (id: string) => {
    const res = await axiosClient.delete(`/grades/admin/item/${id}`);
    return res.data;
  },

  // ✅ GVCN xem tất cả điểm của lớp chủ nhiệm (tất cả môn)
  getHomeroomClassAllGrades: async (params: {
    classId: string;
    schoolYear: string;
    semester: string;
  }) => {
    const res = await axiosClient.get('/grades/homeroom/all', { params });
    return res.data;
  },

  // ✅ GVCN xem điểm trung bình từng môn, điểm TB học kỳ/năm của học sinh
  getHomeroomClassAverages: async (params: {
    classId: string;
    schoolYear: string;
    studentId?: string;
  }) => {
    const res = await axiosClient.get('/grades/homeroom/averages', { params });
    return res.data;
  },

  // ✅ GVCN xem hạnh kiểm và kết quả xếp loại học tập của lớp
  getHomeroomClassClassification: async (params: {
    classId: string;
    schoolYear: string;
    semester?: string;
  }) => {
    const res = await axiosClient.get('/grades/homeroom/classification', { params });
    return res.data;
  },
};

export default gradesApi;

import axiosClient from './axiosInstance';

const gradesApi = {
  // ✅ Lưu điểm nhiều học sinh cùng lúc
  saveScores: async (payload: {
    classId: string;
    subjectId: string;
    schoolYear: string;
    semester: string;
    scores: {
      studentId: string;
      oral?: number;
      quiz15?: number;
      quiz45?: number;
      midterm?: number;
      final?: number;
    }[];
  }) => {
    const res = await axiosClient.post('/grades/save', payload);
    return res.data;
  },

  // ✅ Thêm hoặc cập nhật điểm cho học sinh (1 học sinh hoặc 1 cột)
  upsertGradeItem: async (payload: any) => {
    const res = await axiosClient.post('/grades/items', payload);
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
};

export default gradesApi;

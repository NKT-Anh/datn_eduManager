import api from './axiosInstance';

export interface SurveyQuestion {
  _id?: string;
  question: string;
  order: number;
  weight?: number;
}

export interface Survey {
  _id: string;
  title: string;
  description?: string;
  subjectId: {
    _id: string;
    name: string;
    code: string;
  };
  semester: '1' | '2';
  year: string;
  questions: SurveyQuestion[];
  minScore: number;
  maxScore: number;
  status: 'draft' | 'active' | 'inactive' | 'closed';
  allowedClasses?: Array<{
    _id: string;
    className: string;
    classCode: string;
    grade: string;
  }>;
  allowedStudents?: string[];
  startDate?: string;
  endDate?: string;
  notificationSent?: boolean;
  notificationSentAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    _id: string;
    email: string;
  };
}

export interface SurveyResponse {
  _id: string;
  surveyId: string;
  studentId: string;
  teacherId: string;
  answers: Array<{
    questionId: string;
    questionOrder: number;
    score: number;
    question: string;
    weight: number;
  }>;
  year: string;
  semester: '1' | '2';
  averageScore: number;
  weightedAverageScore: number;
  submittedAt: string;
}

export interface CreateSurveyData {
  title: string;
  description?: string;
  subjectId: string;
  semester: '1' | '2';
  year: string;
  questions?: SurveyQuestion[];
  minScore?: number;
  maxScore?: number;
  allowedClasses?: string[];
  allowedStudents?: string[];
  startDate?: string;
  endDate?: string;
}

export interface UpdateSurveyData extends Partial<CreateSurveyData> {
  status?: 'draft' | 'active' | 'inactive' | 'closed';
}

export interface SubmitSurveyResponseData {
  surveyId: string;
  teacherId: string;
  answers: Array<{
    questionId: string;
    score: number;
  }>;
}

export interface TeacherStatistics {
  teacher: {
    _id: string;
    name: string;
    teacherCode: string;
  };
  statistics: Array<{
    survey: {
      _id: string;
      title: string;
      subjectId: {
        _id: string;
        name: string;
      };
    };
    responseCount: number;
    questionStatistics: Array<{
      questionId: string;
      question: string;
      order: number;
      averageScore: number;
      responseCount: number;
    }>;
    overallAverage: number;
    overallWeightedAverage: number;
  }>;
  summary: {
    totalResponses: number;
    averageScore: number;
    weightedAverageScore: number;
  };
}

export interface SurveyDashboard {
  summary: {
    totalResponses: number;
    overallAverage: number;
    scoreDistribution: {
      excellent: number;
      good: number;
      average: number;
      needs_improvement: number;
    };
    totalTeachers: number;
    totalSubjects: number;
    totalDepartments: number;
    totalClasses: number;
  };
  teacherRankings: Array<{
    teacher: {
      _id: string;
      name: string;
      teacherCode: string;
    };
    responseCount: number;
    averageScore: number;
    rating: 'excellent' | 'good' | 'average' | 'needs_improvement';
    ratingLabel: string;
    rank: number;
  }>;
  subjectStatistics: Array<{
    subjectId: string;
    subjectName: string;
    responseCount: number;
    averageScore: number;
    rating: string;
  }>;
  departmentStatistics: Array<{
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    responseCount: number;
    averageScore: number;
    rating: string;
  }>;
  classStatistics: Array<{
    classId: string;
    className: string;
    responseCount: number;
    averageScore: number;
    rating: string;
  }>;
  filters: {
    year: string;
    semester: string;
    subjectId: string;
    departmentId: string;
    classId: string;
  };
}

const surveyApi = {
  // ✅ Admin: Tạo khảo sát
  createSurvey: async (data: CreateSurveyData) => {
    const response = await api.post('/surveys', data);
    return response.data;
  },

  // ✅ Lấy danh sách khảo sát
  getAllSurveys: async (params?: {
    subjectId?: string;
    semester?: string;
    year?: string;
    status?: string;
    isDeleted?: string;
  }) => {
    const response = await api.get('/surveys', { params });
    return response.data;
  },

  // ✅ Lấy chi tiết 1 khảo sát
  getSurvey: async (id: string) => {
    const response = await api.get(`/surveys/${id}`);
    return response.data;
  },

  // ✅ Admin: Cập nhật khảo sát
  updateSurvey: async (id: string, data: UpdateSurveyData) => {
    const response = await api.put(`/surveys/${id}`, data);
    return response.data;
  },

  // ✅ Admin: Xóa mềm khảo sát
  deleteSurvey: async (id: string) => {
    const response = await api.delete(`/surveys/${id}`);
    return response.data;
  },

  // ✅ Admin: Mở khảo sát cho học sinh
  openSurveyForStudents: async (id: string, data?: {
    classIds?: string[];
    studentIds?: string[];
    sendNotification?: boolean;
  }) => {
    // ✅ Đảm bảo luôn gửi một object, không phải undefined
    const response = await api.post(`/surveys/${id}/open`, data || {});
    return response.data;
  },

  // ✅ Admin: Theo dõi tiến độ khảo sát
  getSurveyProgress: async (id: string) => {
    const response = await api.get(`/surveys/${id}/progress`);
    return response.data;
  },

  // ✅ Học sinh: Lấy danh sách khảo sát có thể tham gia
  getAvailableSurveys: async () => {
    const response = await api.get('/surveys/student/available');
    return response.data;
  },

  // ✅ Học sinh: Submit đánh giá giáo viên
  submitSurveyResponse: async (data: SubmitSurveyResponseData) => {
    const response = await api.post('/surveys/student/submit', data);
    return response.data;
  },

  // ✅ Giáo viên: Xem thống kê điểm khảo sát của mình
  getTeacherStatistics: async (params?: {
    surveyId?: string;
    year?: string;
    semester?: string;
    subjectId?: string;
  }) => {
    const response = await api.get('/surveys/teacher/statistics', { params });
    return response.data;
  },

  // ✅ BGH: Xem báo cáo tổng hợp khảo sát
  getBGHReport: async (params?: {
    year?: string;
    semester?: string;
    subjectId?: string;
    classId?: string;
    surveyId?: string;
  }) => {
    const response = await api.get('/surveys/bgh/report', { params });
    return response.data;
  },

  // ✅ Tính điểm trung bình và phân loại giáo viên
  calculateTeacherRatings: async (params?: {
    year?: string;
    semester?: string;
  }) => {
    const response = await api.post('/surveys/statistics/calculate-ratings', null, { params });
    return response.data;
  },

  // ✅ Dashboard tổng hợp cho Admin/BGH
  getSurveyDashboard: async (params?: {
    year?: string;
    semester?: string;
    subjectId?: string;
    departmentId?: string;
    classId?: string;
  }) => {
    const response = await api.get('/surveys/statistics/dashboard', { params });
    return response.data;
  },

  // ✅ Trao danh hiệu/khen thưởng cho giáo viên
  awardTeacher: async (data: {
    teacherId: string;
    title: string;
    year?: string;
    semester?: string;
    reason?: string;
    surveyAverageScore?: number;
  }) => {
    const response = await api.post('/surveys/awards', data);
    return response.data;
  },

  // ✅ Lấy danh sách giáo viên có danh hiệu/khen thưởng
  getTeachersWithAwards: async (params?: {
    year?: string;
  }) => {
    const response = await api.get('/surveys/awards/teachers', { params });
    return response.data;
  },

  // ✅ Giáo viên: Xem danh hiệu/khen thưởng của chính mình
  getMyAwards: async (params?: {
    year?: string;
    semester?: string;
  }) => {
    const response = await api.get('/surveys/awards/my-awards', { params });
    return response.data;
  },
};

export default surveyApi;


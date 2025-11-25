import axiosClient from './axiosInstance';

const attendanceApi = {
  // 📋 Điểm danh cho lớp chủ nhiệm theo buổi (GVCN) - chỉ nhập học sinh vắng mặt
  // Hoặc điểm danh theo tiết (backward compatible)
  takeAttendance: async (payload: {
    classId: string;
    date: string; // ISO date string
    // GVCN điểm danh theo buổi
    session?: 'morning' | 'afternoon';
    absentStudents?: Array<{
      studentId: string;
      status: 'absent' | 'excused' | 'late';
      notes?: string;
    }>;
    // Backward compatible - điểm danh theo tiế
    subjectId?: string;
    period?: number;
    attendances?: Array<{
      studentId: string;
      status: 'present' | 'absent' | 'excused' | 'late';
      notes?: string;
    }>;
    schoolYear?: string;
    semester?: string;
  }) => {
    const res = await axiosClient.post('/attendance/take', payload);
    return res.data;
  },

  // 📋 Lấy danh sách điểm danh
  getAttendance: async (params?: {
    classId?: string;
    date?: string;
    session?: 'morning' | 'afternoon'; // GVCN điểm danh theo buổi
    studentId?: string;
    schoolYear?: string;
    semester?: string;
    teacherId?: string;
    // Backward compatible
    startDate?: string;
    endDate?: string;
    subjectId?: string;
    period?: number;
  }) => {
    const res = await axiosClient.get('/attendance', { params });
    return res.data;
  },

  // 📋 Cập nhật điểm danh
  updateAttendance: async (id: string, payload: {
    status?: 'present' | 'absent' | 'excused' | 'late';
    notes?: string;
    reason?: string; // Lý do chỉnh sửa (bắt buộc nếu chỉnh sửa điểm danh ngày trước)
  }) => {
    const res = await axiosClient.put(`/attendance/${id}`, payload);
    return res.data;
  },

  // 📋 Lấy lịch sử chỉnh sửa điểm danh (BGH/Admin)
  getAttendanceEditHistory: async (params?: {
    classId?: string;
    startDate?: string;
    endDate?: string;
    schoolYear?: string;
    semester?: string;
    studentId?: string;
  }) => {
    const res = await axiosClient.get('/attendance/edit-history', { params });
    return res.data;
  },

  // 📋 Lấy thống kê điểm danh
  getAttendanceStats: async (params?: {
    studentId?: string;
    classId?: string;
    schoolYear?: string;
    semester?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await axiosClient.get('/attendance/stats', { params });
    return res.data;
  },

  // 📋 Lấy danh sách học sinh trong lớp để điểm danh
  getStudentsForAttendance: async (classId: string) => {
    const res = await axiosClient.get(`/attendance/class/${classId}/students`);
    return res.data;
  },

  // 📊 Thống kê chi tiết theo lớp (Admin)
  getAttendanceStatsByClass: async (params?: {
    schoolYear?: string;
    semester?: string;
    startDate?: string;
    endDate?: string;
    grade?: string;
  }) => {
    const res = await axiosClient.get('/attendance/stats/by-class', { params });
    return res.data;
  },

  // 📊 Thống kê theo khối (Admin)
  getAttendanceStatsByGrade: async (params?: {
    schoolYear?: string;
    semester?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await axiosClient.get('/attendance/stats/by-grade', { params });
    return res.data;
  },

  // 📈 Xu hướng điểm danh (Admin)
  getAttendanceTrends: async (params?: {
    schoolYear?: string;
    semester?: string;
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
    classId?: string;
    grade?: string;
  }) => {
    const res = await axiosClient.get('/attendance/stats/trends', { params });
    return res.data;
  },

  // 📊 Thống kê tổng quan (Admin)
  getAttendanceOverview: async (params?: {
    schoolYear?: string;
    semester?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await axiosClient.get('/attendance/stats/overview', { params });
    return res.data;
  },

  // 📊 Thống kê hôm nay cho BGH
  getTodayAttendanceStats: async (params?: {
    schoolYear?: string;
    semester?: string;
  }) => {
    const res = await axiosClient.get('/attendance/stats/today', { params });
    return res.data;
  },

  // 🔔 Cảnh báo điểm danh cho BGH
  getAttendanceAlerts: async (params?: {
    schoolYear?: string;
    semester?: string;
  }) => {
    const res = await axiosClient.get('/attendance/alerts', { params });
    return res.data;
  },

  // 📋 Điểm danh theo lớp hôm nay cho BGH
  getTodayAttendanceByClass: async (classId: string, params?: {
    schoolYear?: string;
    semester?: string;
  }) => {
    const res = await axiosClient.get(`/attendance/class/${classId}/today`, { params });
    return res.data;
  },
};

export default attendanceApi;


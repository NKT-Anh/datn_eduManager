import axiosClient from './axiosInstance';

const attendanceApi = {
  // 📋 Điểm danh cho một lớp trong một tiết học
  takeAttendance: async (payload: {
    classId: string;
    subjectId: string;
    date: string; // ISO date string
    period: number;
    attendances: Array<{
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
    startDate?: string;
    endDate?: string;
    subjectId?: string;
    studentId?: string;
    schoolYear?: string;
    semester?: string;
    period?: number;
    teacherId?: string;
  }) => {
    const res = await axiosClient.get('/attendance', { params });
    return res.data;
  },

  // 📋 Cập nhật điểm danh
  updateAttendance: async (id: string, payload: {
    status?: 'present' | 'absent' | 'excused' | 'late';
    notes?: string;
  }) => {
    const res = await axiosClient.put(`/attendance/${id}`, payload);
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
};

export default attendanceApi;


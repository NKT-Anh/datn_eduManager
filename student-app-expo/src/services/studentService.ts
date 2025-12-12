/**
 * Student Service - API calls for student features
 */

import { httpClient } from './httpClient';
import { Schedule, Grade, ExamSchedule, Notification, User } from '../types';

// Small in-memory cache to avoid repeated calls
let cachedMe: User | null = null;
let cachedStudent: any | null = null;

const getDefaultSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const getDefaultSemester = () => '1';

const ensureMe = async (): Promise<User> => {
  if (cachedMe) return cachedMe;
  const res = await httpClient.get<User>('/accounts/me');
  cachedMe = res.data;
  return cachedMe;
};

// Student self profile (to get classId)
const ensureStudent = async (): Promise<any> => {
  if (cachedStudent) return cachedStudent;
  const res = await httpClient.get<any[]>('/students');
  const list = Array.isArray(res.data) ? res.data : [];
  cachedStudent = list[0] || null;
  return cachedStudent;
};

export const studentService = {
  async getMyStudentProfile(): Promise<any> {
    return await ensureStudent();
  },

  /**
   * Get student schedule
   */
  async getSchedule(year?: string, semester?: string): Promise<Schedule> {
    const y = year || getDefaultSchoolYear();
    const sem = semester || getDefaultSemester();
    const student = await ensureStudent();
    const classId = typeof student?.classId === 'object' ? student?.classId?._id : student?.classId;
    if (!classId) {
      throw new Error('Không tìm thấy lớp của học sinh để lấy thời khóa biểu.');
    }
    const response = await httpClient.get<Schedule>(`/schedules/${String(classId)}/${y}/${sem}`);
    return response.data as any;
  },

  /**
   * Get student grades
   */
  async getGrades(year?: string, semester?: string): Promise<Grade[]> {
    const params = new URLSearchParams();
    if (year) params.append('schoolYear', year);
    if (semester) params.append('semester', semester);
    const response = await httpClient.get<any>(
      `/grades/student${params.toString() ? `?${params.toString()}` : ''}`
    );
    // backend may return { success, data } or direct array
    const payload = response.data as any;
    return (payload?.data && Array.isArray(payload.data) ? payload.data : payload) as Grade[];
  },

  /**
   * Get exam schedule
   */
  async getExamSchedule(examId?: string): Promise<ExamSchedule[]> {
    // Prefer using student-exams module like web
    const me = await ensureMe();
    const studentId = me.studentId;
    if (!studentId) {
      throw new Error('Không tìm thấy studentId của tài khoản.');
    }
    if (!examId) {
      // If no exam selected: return empty; screen should load exams then call by examId.
      return [];
    }
    const response = await httpClient.get<any[]>(
      `/student-exams/exam/${String(examId)}/student/${String(studentId)}/schedules`
    );
    return (Array.isArray(response.data) ? response.data : []) as any;
  },

  /**
   * Get notifications
   */
  async getNotifications(limit?: number): Promise<Notification[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await httpClient.get<Notification[]>(
      `/notifications${params}`
    );
    return response.data;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    // Backend: POST /notifications/:id/read
    await httpClient.post(`/notifications/${notificationId}/read`, {});
  },

  async markAllAsRead(): Promise<void> {
    await httpClient.post('/notifications/read-all', {});
  },

  async getNotificationById(id: string): Promise<any> {
    const res = await httpClient.get<any>(`/notifications/${id}`);
    return (res.data?.data ?? res.data) as any;
  },

  async getNotificationReplies(notificationId: string): Promise<any[]> {
    const res = await httpClient.get<any[]>(`/notifications/replies/${notificationId}`);
    const payload = res.data as any;
    return Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
  },

  async createNotificationReply(notificationId: string, content: string): Promise<any> {
    const res = await httpClient.post<any>(`/notifications/replies/${notificationId}`, { content });
    return (res.data?.data ?? res.data) as any;
  },

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    const response = await httpClient.get<{ count: number }>(
      '/notifications/unread/count'
    );
    return response.data.count;
  },

  /**
   * Get attendance records
   */
  async getAttendanceRecords(params?: {
    year?: string;
    semester?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.year) queryParams.append('schoolYear', params.year);
    if (params?.semester) queryParams.append('semester', params.semester);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const response = await httpClient.get<any[]>(
      `/attendance${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return response.data;
  },

  /**
   * Get attendance stats
   */
  async getAttendanceStats(params?: {
    year?: string;
    semester?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.year) queryParams.append('schoolYear', params.year);
    if (params?.semester) queryParams.append('semester', params.semester);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const response = await httpClient.get<any>(
      `/attendance/stats${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return response.data;
  },

  /**
   * Get available surveys
   */
  async getAvailableSurveys(): Promise<any> {
    const response = await httpClient.get<any>('/surveys/student/available');
    return response.data;
  },

  /**
   * Submit survey response
   */
  async submitSurveyResponse(data: {
    surveyId: string;
    teacherId: string;
    answers: Array<{ questionId: string; score: number }>;
  }): Promise<any> {
    const response = await httpClient.post<any>('/surveys/student/submit', data);
    return response.data;
  },

  /**
   * Get conduct records
   */
  async getConducts(params?: {
    year?: string;
    semester?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.year) queryParams.append('year', params.year);
    if (params?.semester) queryParams.append('semester', params.semester);

    const response = await httpClient.get<any>(
      `/conducts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return response.data;
  },

  /**
   * Get exam grades
   */
  async getExamGrades(examId: string): Promise<any[]> {
    const me = await ensureMe();
    const studentId = me.studentId;
    if (!studentId) {
      throw new Error('Không tìm thấy studentId của tài khoản.');
    }
    const response = await httpClient.get<any[]>(
      `/student-exams/exam/${String(examId)}/student/${String(studentId)}/grades`
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async getExamRoom(scheduleId: string): Promise<any> {
    const me = await ensureMe();
    const studentId = me.studentId;
    if (!studentId) {
      throw new Error('Không tìm thấy studentId của tài khoản.');
    }
    const res = await httpClient.get<any>(
      `/student-exams/schedule/${String(scheduleId)}/student/${String(studentId)}/room`
    );
    return (res.data?.data ?? res.data) as any;
  },

  /**
   * Get all exams for student
   */
  async getAllExams(): Promise<any[]> {
    const me = await ensureMe();
    const studentId = me.studentId;
    if (!studentId) {
      throw new Error('Không tìm thấy studentId của tài khoản.');
    }
    const response = await httpClient.get<any[]>(
      `/student-exams/student/${String(studentId)}/exams`
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  invalidateCache() {
    cachedMe = null;
    cachedStudent = null;
  },
};


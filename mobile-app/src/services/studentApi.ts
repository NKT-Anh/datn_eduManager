/**
 * Student API Service
 * Các API để học sinh truy cập vào app
 */

import {httpClient} from './httpClient';
import {Student} from '../types';

export interface StudentSchedule {
  _id: string;
  subject: {
    _id: string;
    name: string;
    code: string;
  };
  date: string;
  startTime: string;
  endTime: string;
  room?: {
    roomCode: string;
  };
  fixedRoomCode?: string;
  seatNumber?: number;
}

export interface StudentGrade {
  _id: string;
  subject: {
    _id: string;
    name: string;
    code: string;
  };
  semester: string;
  schoolYear: string;
  average: number;
  academicLevel?: string;
}

export interface StudentExam {
  _id: string;
  name: string;
  year: string;
  semester: string;
  type: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export interface StudentExamSchedule {
  _id: string;
  subject: {
    _id: string;
    name: string;
    code: string;
  };
  date: string;
  startTime: string;
  endTime: string;
  room?: {
    roomCode: string;
  };
  fixedRoomCode?: string;
  seatNumber?: number;
  sbd?: string;
}

export const studentApi = {
  /**
   * Get student profile
   */
  async getProfile(studentId: string): Promise<Student> {
    const response = await httpClient.get<Student>(`/students/${studentId}`);
    return response.data;
  },

  /**
   * Get student schedule (lịch học)
   */
  async getSchedule(studentId: string, schoolYear?: string): Promise<any> {
    const params = schoolYear ? `?schoolYear=${schoolYear}` : '';
    const response = await httpClient.get(
      `/students/${studentId}/schedule${params}`,
    );
    return response.data;
  },

  /**
   * Get student grades (điểm số)
   */
  async getGrades(
    studentId: string,
    schoolYear?: string,
    semester?: string,
  ): Promise<StudentGrade[]> {
    let params = '?';
    if (schoolYear) params += `schoolYear=${schoolYear}&`;
    if (semester) params += `semester=${semester}&`;
    params = params.slice(0, -1); // Remove last &

    const response = await httpClient.get<StudentGrade[]>(
      `/students/${studentId}/grades${params === '?' ? '' : params}`,
    );
    return response.data;
  },

  /**
   * Get student exam list (danh sách kỳ thi)
   */
  async getExams(studentId: string): Promise<StudentExam[]> {
    const response = await httpClient.get<StudentExam[]>(
      `/student-exams/student/${studentId}/exams`,
    );
    return response.data || [];
  },

  /**
   * Get student exam schedules (lịch thi)
   */
  async getExamSchedules(
    examId: string,
    studentId: string,
  ): Promise<StudentExamSchedule[]> {
    const response = await httpClient.get<StudentExamSchedule[]>(
      `/student-exams/exam/${examId}/student/${studentId}/schedules`,
    );
    return response.data || [];
  },

  /**
   * Get student exam room and seat (phòng thi và chỗ ngồi)
   */
  async getExamRoom(
    scheduleId: string,
    studentId: string,
  ): Promise<{
    room: string;
    roomType: string;
    seatNumber: number;
    sbd: string;
    status: string;
  }> {
    const response = await httpClient.get(
      `/student-exams/schedule/${scheduleId}/student/${studentId}/room`,
    );
    return response.data;
  },

  /**
   * Get student exam grades (điểm thi)
   */
  async getExamGrades(
    examId: string,
    studentId: string,
  ): Promise<StudentGrade[]> {
    const response = await httpClient.get<StudentGrade[]>(
      `/student-exams/exam/${examId}/student/${studentId}/grades`,
    );
    return response.data || [];
  },

  /**
   * Get student attendance (điểm danh)
   */
  async getAttendance(
    studentId: string,
    schoolYear?: string,
    semester?: string,
  ): Promise<any> {
    let params = '?';
    if (schoolYear) params += `schoolYear=${schoolYear}&`;
    if (semester) params += `semester=${semester}&`;
    params = params.slice(0, -1);

    const response = await httpClient.get(
      `/students/${studentId}/attendance${params === '?' ? '' : params}`,
    );
    return response.data;
  },

  /**
   * Get student notifications (thông báo)
   */
  async getNotifications(studentId: string): Promise<any[]> {
    const response = await httpClient.get(
      `/notifications?userId=${studentId}&role=student`,
    );
    return response.data || [];
  },
};


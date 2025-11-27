/**
 * Teacher Service
 */

import {httpClient} from './httpClient';
import {Teacher} from '../types';

export const teacherService = {
  /**
   * Get teacher profile
   */
  async getProfile(teacherId: string): Promise<Teacher> {
    const response = await httpClient.get<Teacher>(`/teachers/${teacherId}`);
    return response.data;
  },

  /**
   * Get teacher schedule
   */
  async getSchedule(teacherId: string) {
    const response = await httpClient.get(`/teachers/${teacherId}/schedule`);
    return response.data;
  },

  /**
   * Get exam invigilation schedule
   */
  async getExamSchedules(teacherId: string, examId?: string) {
    const params = examId ? `?examId=${examId}` : '';
    const response = await httpClient.get(
      `/teacher-exams/teacher/${teacherId}/schedules${params}`,
    );
    return response.data;
  },

  /**
   * Get exam rooms assigned
   */
  async getExamRooms(teacherId: string, examId?: string) {
    const params = examId ? `?examId=${examId}` : '';
    const response = await httpClient.get(
      `/teacher-exams/teacher/${teacherId}/rooms${params}`,
    );
    return response.data;
  },
};


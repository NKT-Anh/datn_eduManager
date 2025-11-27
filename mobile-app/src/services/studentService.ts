/**
 * Student Service
 */

import {httpClient} from './httpClient';
import {Student} from '../types';

export const studentService = {
  /**
   * Get student profile
   */
  async getProfile(studentId: string): Promise<Student> {
    const response = await httpClient.get<Student>(`/students/${studentId}`);
    return response.data;
  },

  /**
   * Get student grades
   */
  async getGrades(studentId: string, schoolYear?: string) {
    const params = schoolYear ? `?schoolYear=${schoolYear}` : '';
    const response = await httpClient.get(`/students/${studentId}/grades${params}`);
    return response.data;
  },

  /**
   * Get student schedule
   */
  async getSchedule(studentId: string) {
    const response = await httpClient.get(`/students/${studentId}/schedule`);
    return response.data;
  },

  /**
   * Get student exam schedules
   */
  async getExamSchedules(studentId: string) {
    const response = await httpClient.get(`/student-exams/student/${studentId}/exams`);
    return response.data;
  },
};


/**
 * Type definitions for EduManager Mobile
 */

export interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

export interface Student extends User {
  studentCode?: string;
  grade?: string;
  classId?: string;
}

export interface Teacher extends User {
  teacherCode?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}


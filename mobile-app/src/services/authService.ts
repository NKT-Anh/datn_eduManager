/**
 * Authentication Service
 */

import {httpClient} from './httpClient';
import {AuthResponse, User} from '../types';

export const authService = {
  /**
   * Login with phone/email and password
   */
  async login(phoneOrEmail: string, password: string): Promise<AuthResponse> {
    const response = await httpClient.post<AuthResponse>('/auth/login', {
      phoneOrEmail,
      password,
    });
    
    if (response.success && response.data.token) {
      httpClient.setToken(response.data.token);
    }
    
    return response.data;
  },

  /**
   * Logout
   */
  async logout(): Promise<void> {
    httpClient.clearToken();
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await httpClient.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Refresh token
   */
  async refreshToken(): Promise<string> {
    const response = await httpClient.post<{token: string}>('/auth/refresh');
    if (response.success && response.data.token) {
      httpClient.setToken(response.data.token);
    }
    return response.data.token;
  },
};


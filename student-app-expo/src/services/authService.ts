/**
 * Authentication Service
 */

import { httpClient } from './httpClient';
import { AuthResponse, User } from '../types';
import { loginWithCustomToken } from './firebase/authService';

export const authService = {
  // ✅ Password login được xử lý bằng Firebase ở AuthContext (giống web)

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
    // Backend: GET /accounts/me (không phải /auth/me)
    const response = await httpClient.get<User>('/accounts/me');
    return response.data;
  },

  /**
   * Refresh token
   */
  async refreshToken(): Promise<string> {
    // Backend hiện không expose /auth/refresh -> giữ hàm để tương thích, nhưng báo rõ
    throw new Error('API refresh token chưa được hỗ trợ trên backend.');
  },

  /**
   * Send OTP for login
   */
  async sendLoginOTP(email: string): Promise<void> {
    await httpClient.post('/auth/send-login-otp', { email });
  },

  /**
   * Login with OTP
   */
  async loginWithOTP(email: string, otpCode: string): Promise<AuthResponse> {
    // Backend trả: { success: true, customToken, ... }
    const response = await httpClient.post<any>('/auth/verify-login-otp', {
      email,
      otpCode,
    });
    const payload = response.data;
    const customToken = payload?.customToken;
    if (!customToken) {
      throw new Error(payload?.message || 'Không nhận được customToken từ server');
    }

    // Giống web: đăng nhập Firebase bằng customToken -> lấy idToken
    const idToken = await loginWithCustomToken(customToken);
    await httpClient.setToken(idToken);

    // Lấy thông tin user từ backend
    const user = await authService.getCurrentUser();
    return { token: idToken, user };
  },
};


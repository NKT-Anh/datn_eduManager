/**
 * Authentication Context
 */

import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {User} from '../types';
import {authService} from '../services/authService';
import {firebaseAuthService} from '../services/firebaseAuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phoneOrEmail: string, password: string) => Promise<void>;
  loginWithFirebase: (phoneOrEmail: string, password?: string) => Promise<void>;
  loginWithPhone: (phoneNumber: string) => Promise<string>;
  verifyPhoneCode: (verificationId: string, code: string) => Promise<void>;
  sendLoginOTP: (email: string) => Promise<void>;
  loginWithOTP: (email: string, otpCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@EduManager:token';
const USER_KEY = '@EduManager:user';

export const AuthProvider: React.FC<{children: ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [token, userData] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (token && userData) {
        // Set token in httpClient
        const {httpClient} = require('../services/httpClient');
        httpClient.setToken(token);
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phoneOrEmail: string, password: string) => {
    try {
      const authResponse = await authService.login(phoneOrEmail, password);
      
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, authResponse.token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(authResponse.user)),
      ]);

      setUser(authResponse.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithFirebase = async (phoneOrEmail: string, password?: string) => {
    try {
      const authResponse = await firebaseAuthService.signInAndGetBackendToken(
        phoneOrEmail,
        password,
      );
      
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, authResponse.token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(authResponse.user)),
      ]);

      setUser(authResponse.user);
    } catch (error) {
      console.error('Firebase login error:', error);
      throw error;
    }
  };

  const loginWithPhone = async (phoneNumber: string): Promise<string> => {
    try {
      const verificationId = await firebaseAuthService.signInWithPhone(
        phoneNumber,
      );
      return verificationId;
    } catch (error) {
      console.error('Phone login error:', error);
      throw error;
    }
  };

  const verifyPhoneCode = async (
    verificationId: string,
    code: string,
  ): Promise<void> => {
    try {
      const firebaseUid = await firebaseAuthService.verifyPhoneCode(
        verificationId,
        code,
      );

      // Get Firebase token and send to backend
      const firebaseToken = await firebaseAuthService.getIdToken();
      if (!firebaseToken) {
        throw new Error('Không thể lấy Firebase token');
      }

      const {httpClient} = require('../services/httpClient');
      const response = await httpClient.post('/auth/firebase', {
        firebaseToken,
        firebaseUid,
      });

      if (response.success && response.data.token) {
        httpClient.setToken(response.data.token);
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, response.data.token),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(response.data.user)),
        ]);
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Verify phone code error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      await firebaseAuthService.signOut();
      await Promise.all([
        AsyncStorage.removeItem(TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  /**
   * 📧 Gửi mã OTP đăng nhập
   */
  const sendLoginOTP = async (email: string) => {
    try {
      const {httpClient} = require('../services/httpClient');
      const response = await httpClient.post('/auth/send-login-otp', {email});
      
      if (!response.success) {
        throw new Error(response.message || 'Không thể gửi mã OTP');
      }
    } catch (error: any) {
      console.error('Send login OTP error:', error);
      throw new Error(error.message || 'Không thể gửi mã OTP. Vui lòng thử lại');
    }
  };

  /**
   * ✅ Xác thực OTP và đăng nhập
   */
  const loginWithOTP = async (email: string, otpCode: string) => {
    try {
      const {httpClient} = require('../services/httpClient');
      const response = await httpClient.post('/auth/verify-login-otp', {
        email,
        otpCode,
      });

      if (!response.success || !response.data.customToken) {
        throw new Error(response.message || 'Mã OTP không đúng');
      }

      // Đăng nhập Firebase với custom token
      const {firebaseAuthService} = require('../services/firebaseAuthService');
      await firebaseAuthService.signInWithCustomToken(response.data.customToken);
      
      // Lấy Firebase token
      const firebaseToken = await firebaseAuthService.getIdToken();
      if (!firebaseToken) {
        throw new Error('Không thể lấy Firebase token');
      }

      // Set token trước khi gọi API (httpClient sẽ tự động gắn vào header)
      httpClient.setToken(firebaseToken);

      // Lấy thông tin user từ backend
      const userResponse = await httpClient.get('/accounts/me');

      if (userResponse.success && userResponse.data) {
        const userData = userResponse.data;
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, firebaseToken),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
        ]);
        setUser(userData);
      } else {
        throw new Error('Không thể lấy thông tin người dùng');
      }
    } catch (error: any) {
      console.error('Login with OTP error:', error);
      throw new Error(error.message || 'Không thể đăng nhập với mã OTP');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithFirebase,
        loginWithPhone,
        verifyPhoneCode,
        sendLoginOTP,
        loginWithOTP,
        logout,
        refreshUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


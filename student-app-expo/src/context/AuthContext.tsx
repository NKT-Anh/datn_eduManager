/**
 * Authentication Context
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { httpClient } from '../services/httpClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginWithEmail } from '../services/firebase/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phoneOrEmail: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = '@StudentApp:user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const ensureStudentRole = async (u: User) => {
    if (u?.role !== 'student') {
      // Chỉ cho phép học sinh dùng app này
      await authService.logout();
      setUser(null);
      await AsyncStorage.removeItem(USER_KEY);
      throw new Error('Ứng dụng này chỉ dành cho học sinh. Vui lòng đăng nhập bằng tài khoản học sinh.');
    }
  };

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const userData = await AsyncStorage.getItem(USER_KEY);
      if (userData) {
        const parsedUser = JSON.parse(userData);
        // Nếu cache không phải student -> xoá luôn
        if (parsedUser?.role && parsedUser.role !== 'student') {
          await logout();
          return;
        }
        setUser(parsedUser);
        // Refresh user from server
        try {
          const currentUser = await authService.getCurrentUser();
          await ensureStudentRole(currentUser);
          setUser(currentUser);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        } catch (error) {
          // Token might be expired, clear storage
          await logout();
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phoneOrEmail: string, password: string) => {
    try {
      // ✅ Giống web: đăng nhập Firebase -> lấy idToken -> gọi /accounts/me
      const idToken = await loginWithEmail(phoneOrEmail, password);
      await loginWithToken(idToken);
    } catch (error: any) {
      throw new Error(error.message || 'Đăng nhập thất bại');
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      await AsyncStorage.removeItem(USER_KEY);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const loginWithToken = async (token: string) => {
    try {
      httpClient.setToken(token);
      const currentUser = await authService.getCurrentUser();
      await ensureStudentRole(currentUser);
      setUser(currentUser);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    } catch (error: any) {
      throw new Error(error.message || 'Đăng nhập thất bại');
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      await ensureStudentRole(currentUser);
      setUser(currentUser);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithToken,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


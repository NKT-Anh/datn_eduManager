/**
 * HTTP Client for API calls
 */

import apiConfig from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse } from '../types';

const TOKEN_KEY = '@StudentApp:token';
const SCHOOL_YEAR_KEY = '@StudentApp:schoolYear';

class HttpClient {
  private baseURL: string;
  private token: string | null = null;
  private schoolYear: string | null = null;
  private schoolYearLoaded = false;

  constructor() {
    this.baseURL = apiConfig.baseURL;
    this.loadToken();
    this.loadSchoolYearOnce();
  }

  private async loadToken() {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        this.token = token;
      }
    } catch (error) {
      console.error('Error loading token:', error);
    }
  }

  async setToken(token: string) {
    this.token = token;
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  async clearToken() {
    this.token = null;
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  }

  private async loadSchoolYearOnce() {
    if (this.schoolYearLoaded) return;
    this.schoolYearLoaded = true;
    try {
      const year = await AsyncStorage.getItem(SCHOOL_YEAR_KEY);
      if (year) this.schoolYear = year;
    } catch (error) {
      console.error('Error loading schoolYear:', error);
    }
  }

  async setSchoolYear(year: string) {
    this.schoolYear = year;
    this.schoolYearLoaded = true;
    try {
      await AsyncStorage.setItem(SCHOOL_YEAR_KEY, year);
    } catch (error) {
      console.error('Error saving schoolYear:', error);
    }
  }

  async clearSchoolYear() {
    this.schoolYear = null;
    this.schoolYearLoaded = true;
    try {
      await AsyncStorage.removeItem(SCHOOL_YEAR_KEY);
    } catch (error) {
      console.error('Error clearing schoolYear:', error);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    // Normalize headers to a plain object so TypeScript allows setting Authorization
    const headersObj: Record<string, string> = {
      ...(apiConfig.headers as Record<string, string>),
    };

    if (options.headers) {
      const h = options.headers as any;
      if (typeof Headers !== 'undefined' && h instanceof Headers) {
        h.forEach((value: string, key: string) => {
          headersObj[key] = value;
        });
      } else if (Array.isArray(h)) {
        (h as Array<[string, string]>).forEach(([key, value]) => {
          headersObj[key] = value;
        });
      } else {
        Object.assign(headersObj, h as Record<string, string>);
      }
    }

    if (this.token) {
      headersObj.Authorization = `Bearer ${this.token}`;
    }
    // ✅ Auto attach current school year for permission-context endpoints
    // (used heavily by backend to resolve teacherFlags / schedule visibility / etc.)
    if (!this.schoolYearLoaded) {
      await this.loadSchoolYearOnce();
    }
    if (this.schoolYear && !headersObj['x-school-year']) {
      headersObj['x-school-year'] = this.schoolYear;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: headersObj,
      });

      // Một số trường hợp server trả về HTML (404/502 reverse proxy) -> response.json() sẽ crash
      const text = await response.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!response.ok) {
        const message =
          (data && typeof data === 'object' && data.message) ||
          (typeof data === 'string' && data.trim().startsWith('<!DOCTYPE') ? 'API trả về HTML (sai API_BASE_URL hoặc server chưa chạy).' : null) ||
          response.statusText ||
          'Request failed';
        throw new Error(message);
      }

      // Backend có thể trả về trực tiếp object hoặc wrap trong { success, data }
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        return data as ApiResponse<T>;
      }

      return { success: true, data: data as T } as ApiResponse<T>;
    } catch (error: any) {
      console.error('[HttpClient] API Error:', {
        url,
        message: error.message,
        error,
      });
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', ...options });
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const httpClient = new HttpClient();


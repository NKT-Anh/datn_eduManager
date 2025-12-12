/**
 * Setting Service - Lấy thông tin công khai của trường
 */

import { httpClient } from './httpClient';

export interface PublicSchoolInfo {
  schoolName: string;
  slogan: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  schoolLogo: {
    url: string;
    publicId: string;
    format: string;
  } | null;
  currentSchoolYear?: string | null;
}

export interface FlattenedSchoolInfo {
  name: string;
  slogan: string;
  description: string;
  logoUrl: string;
  raw?: PublicSchoolInfo;
}

const DEFAULT_INFO: FlattenedSchoolInfo = {
  name: 'Hệ thống quản lý trường học',
  slogan: 'Quản lý trường học',
  description: '',
  logoUrl: '',
};

let cachedInfo: FlattenedSchoolInfo | null = null;
let loadingPromise: Promise<FlattenedSchoolInfo> | null = null;

const mapApiToInfo = (payload: PublicSchoolInfo | undefined): FlattenedSchoolInfo => {
  if (!payload) {
    return DEFAULT_INFO;
  }

  return {
    name: payload.schoolName?.trim() || DEFAULT_INFO.name,
    slogan: payload.slogan?.trim() || DEFAULT_INFO.slogan,
    description: payload.description || '',
    logoUrl: payload.schoolLogo?.url || '',
    raw: payload,
  };
};

export const settingService = {
  /**
   * Lấy thông tin công khai của trường (không cần auth)
   */
  async getPublicSchoolInfo(force = false): Promise<FlattenedSchoolInfo> {
    if (!force && cachedInfo) {
      return cachedInfo;
    }

    if (!force && loadingPromise) {
      return loadingPromise;
    }

    const load = httpClient
      .get<PublicSchoolInfo>('/settings/public')
      .then((response) => {
        // httpClient.get() đã wrap trong { success, data }
        const data = response.data;
        // ✅ Đồng bộ currentSchoolYear để httpClient tự attach x-school-year cho tất cả request
        if (data?.currentSchoolYear) {
          httpClient.setSchoolYear(String(data.currentSchoolYear));
        }
        const mapped = mapApiToInfo(data);
        cachedInfo = mapped;
        loadingPromise = null;
        return mapped;
      })
      .catch((error) => {
        loadingPromise = null;
        console.error('[SettingService] Fetch failed:', error);
        return DEFAULT_INFO;
      });

    if (!force) {
      loadingPromise = load;
    }

    const result = await load;
    if (force) {
      cachedInfo = result;
    }

    return result;
  },

  /**
   * Invalidate cache
   */
  invalidateCache() {
    cachedInfo = null;
    loadingPromise = null;
  },
};


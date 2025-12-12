/**
 * Hook để lấy thông tin công khai của trường từ settings
 */

import { useState, useEffect, useCallback } from 'react';
import { settingService, FlattenedSchoolInfo } from '../services/settingService';

export const usePublicSchoolInfo = () => {
  const [info, setInfo] = useState<FlattenedSchoolInfo>({
    name: 'Hệ thống quản lý trường học',
    slogan: 'Quản lý trường học',
    description: '',
    logoUrl: '',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    settingService
      .getPublicSchoolInfo()
      .then((data) => {
        if (!mounted) return;
        setInfo(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('[usePublicSchoolInfo] Fetch failed:', err);
        setError(err);
        setInfo({
          name: 'Hệ thống quản lý trường học',
          slogan: 'Quản lý trường học',
          description: '',
          logoUrl: '',
        });
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingService.getPublicSchoolInfo(true);
      setInfo(data);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('[usePublicSchoolInfo] Refresh failed:', err);
      setError(err);
      setLoading(false);
    }
  }, []);

  return { info, loading, error, refresh };
};


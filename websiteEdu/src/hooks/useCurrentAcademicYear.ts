import { useQuery } from '@tanstack/react-query';
import { useSchoolYears } from './schoolYear/useSchoolYears';
import settingApi from '@/services/settingApi';

/**
 * Hook returns a robust current academic year code and data.
 * It prefers the active year from `useSchoolYears()` but falls back
 * to `settingApi.getSettings()` (which may contain `currentSchoolYear`).
 */
export function useCurrentAcademicYear() {
  const { schoolYears = [], currentYear: syCurrentYear, currentYearData: syCurrentYearData, isLoading: loadingYears } = useSchoolYears();

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings', 'current'],
    queryFn: () => settingApi.getSettings(),
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  // Prefer schoolYears active entry
  const yearData = syCurrentYearData || null;
  const yearCodeFromSchoolYears = syCurrentYearData?.code || syCurrentYearData?.name || syCurrentYear || null;

  // Fallback to settings.currentSchoolYear (may be code or name)
  const settingsYear = settings?.currentSchoolYear || null;

  const currentYearCode = yearData?.code || yearCodeFromSchoolYears || settingsYear || null;

  return {
    currentYearCode,
    currentYearData: yearData,
    loading: loadingYears || loadingSettings,
    schoolYears,
    settings,
  };
}

export default useCurrentAcademicYear;

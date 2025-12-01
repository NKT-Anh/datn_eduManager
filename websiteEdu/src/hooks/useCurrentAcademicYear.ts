import { useQuery } from '@tanstack/react-query';
import { useSchoolYears } from './schoolYear/useSchoolYears';
import { schoolYearApi, type SchoolYear } from '@/services/schoolYearApi';

/**
 * Hook returns a robust current academic year code and data.
 * It prefers the active year from `useSchoolYears()` but falls back
 * to backend `/school-years/current` (which sử dụng schoolYearHelper ở backend).
 */
export function useCurrentAcademicYear() {
  const {
    schoolYears = [],
    currentYear: syCurrentYear,
    currentYearData: syCurrentYearData,
    isLoading: loadingYears,
  } = useSchoolYears();

  // ✅ Fallback: gọi trực tiếp API /school-years/current (đã dùng schoolYearHelper ở backend)
  const {
    data: currentYearFromApi,
    isLoading: loadingCurrentYear,
  } = useQuery<SchoolYear | null>({
    queryKey: ['schoolYears', 'current'],
    queryFn: async () => {
      try {
        return await schoolYearApi.getCurrent();
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Prefer schoolYears active entry
  const yearData = syCurrentYearData || currentYearFromApi || null;
  const yearCodeFromSchoolYears =
    syCurrentYearData?.code || syCurrentYearData?.name || syCurrentYear || null;

  // Fallback to year from /school-years/current (code hoặc name)
  const apiYearCode =
    currentYearFromApi?.code || currentYearFromApi?.name || null;

  const currentYearCode =
    yearData?.code || yearCodeFromSchoolYears || apiYearCode || null;

  return {
    currentYearCode,
    currentYearData: yearData,
    loading: loadingYears || loadingCurrentYear,
    schoolYears,
  };
}

export default useCurrentAcademicYear;

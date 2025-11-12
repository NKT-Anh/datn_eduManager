import { useQuery } from "@tanstack/react-query";
import gradesApi from "@/services/gradesApi";

export function useStudentGrades(studentId?: string) {
  return useQuery({
    queryKey: ["student-grades", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const res = await gradesApi.getStudentGrades({ studentId });
      return res.success ? res.data || [] : [];
    },
    enabled: !!studentId,
  });
}

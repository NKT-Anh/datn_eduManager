import { useQuery } from "@tanstack/react-query";
import { getSubjectDetail } from "@/services/getSubjectDetail";
import { SubjectDetailResponse } from "@/types/class";

/**
 * Hook để lấy chi tiết đầy đủ của một môn học
 * Bao gồm: subject, teachers, classes, assignments, schedules
 */
export function useSubjectDetail(subjectId?: string) {
  return useQuery<SubjectDetailResponse>({
    queryKey: ["subject-detail", subjectId],
    queryFn: () => (subjectId ? getSubjectDetail(subjectId) : null),
    enabled: !!subjectId,
    staleTime: 5 * 60 * 1000, // 5 phút
  });
}


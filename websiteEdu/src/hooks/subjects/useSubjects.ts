import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subjectApi } from "@/services/subjectApi";
import { Subject, SubjectInput } from "@/types/class";

/**
 * Hook để quản lý môn học (Subjects)
 * - Lấy danh sách môn học
 * - Lấy chi tiết môn học
 * - Tạo, cập nhật, xóa môn học
 */
export function useSubjects() {
  const queryClient = useQueryClient();

  // 📘 Lấy danh sách tất cả môn học
  const {
    data: subjects = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => subjectApi.getSubjects(),
    staleTime: 5 * 60 * 1000, // 5 phút
  });

  // ➕ Tạo môn học mới
  const create = useMutation({
    mutationFn: (data: SubjectInput) => subjectApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  }).mutateAsync;

  // ✏️ Cập nhật môn học
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubjectInput }) =>
      subjectApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subject", variables.id] });
    },
  }).mutateAsync;

  // 🗑 Xóa môn học
  const remove = useMutation({
    mutationFn: (id: string) => subjectApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  }).mutateAsync;

  // ⚙️ Cập nhật includeInAverage
  const updateIncludeInAverage = useMutation({
    mutationFn: ({ id, includeInAverage }: { id: string; includeInAverage: boolean }) =>
      subjectApi.updateIncludeInAverage(id, includeInAverage),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subject", variables.id] });
    },
  }).mutateAsync;

  // 🕒 Cập nhật thời lượng thi mặc định
  const updateDefaultExamDuration = useMutation({
    mutationFn: ({ id, defaultExamDuration }: { id: string; defaultExamDuration: number }) =>
      subjectApi.updateDefaultExamDuration(id, defaultExamDuration),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subject", variables.id] });
    },
  }).mutateAsync;

  return {
    subjects,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
    updateIncludeInAverage,
    updateDefaultExamDuration,
  };
}

/**
 * Hook để lấy chi tiết một môn học
 */
export function useSubject(id?: string) {
  return useQuery({
    queryKey: ["subject", id],
    queryFn: () => (id ? subjectApi.getSubjectById(id) : null),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}


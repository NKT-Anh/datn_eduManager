import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teacherApi } from "@/services/teacherApi";
import { Teacher } from "@/types/auth";

/**
 * Hook để quản lý giáo viên (Teachers)
 * - Lấy danh sách giáo viên
 * - Lấy chi tiết giáo viên
 * - Tạo, cập nhật, xóa giáo viên
 */
export function useTeachers(params?: Record<string, any>) {
  const queryClient = useQueryClient();

  // 📘 Lấy danh sách tất cả giáo viên
  const {
    data: teachers = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["teachers", params],
    queryFn: () => teacherApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 phút
  });

  // ➕ Tạo giáo viên mới
  const create = useMutation({
    mutationFn: (data: any) => teacherApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  }).mutateAsync;

  // ✏️ Cập nhật giáo viên
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      teacherApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", variables.id] });
    },
  }).mutateAsync;

  // 🗑 Xóa giáo viên
  const remove = useMutation({
    mutationFn: (id: string) => teacherApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  }).mutateAsync;

  return {
    teachers,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
  };
}

/**
 * Hook để lấy chi tiết một giáo viên
 */
export function useTeacher(id?: string) {
  return useQuery({
    queryKey: ["teacher", id],
    queryFn: () => (id ? teacherApi.getById(id) : null),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook để cập nhật lịch rảnh của giáo viên
 */
export function useUpdateTeacherAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      availableMatrix,
    }: {
      id: string;
      availableMatrix: boolean[][];
    }) => teacherApi.updateAvailability(id, availableMatrix),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teacher", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["teacher", variables.id, "availability"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

/**
 * Hook để lấy lịch rảnh của giáo viên
 */
export function useTeacherAvailability(id?: string) {
  return useQuery({
    queryKey: ["teacher", id, "availability"],
    queryFn: () => (id ? teacherApi.getAvailability(id) : null),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}


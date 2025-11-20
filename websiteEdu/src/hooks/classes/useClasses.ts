import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { classApi, classApiNoToken } from "@/services/classApi";
import { ClassType } from "@/types/class";

/**
 * Hook để quản lý lớp học (Classes)
 * - Lấy danh sách lớp
 * - Lấy chi tiết lớp
 * - Tạo, cập nhật, xóa lớp
 */
export function useClasses(params?: { year?: string; grade?: string }) {
  const queryClient = useQueryClient();

  // 📘 Lấy danh sách tất cả lớp
  const {
    data: classes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["classes", params],
    queryFn: () => classApi.getAll(),
    select: (data) => {
      // Lọc theo params nếu có
      if (!params) return data;
      let filtered = data;
      if (params.year) {
        filtered = filtered.filter((c) => c.year === params.year);
      }
      if (params.grade) {
        filtered = filtered.filter((c) => String(c.grade) === params.grade);
      }
      return filtered;
    },
    staleTime: 5 * 60 * 1000, // 5 phút
  });

  // ➕ Tạo lớp mới
  const create = useMutation({
    mutationFn: (data: any) => classApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  }).mutateAsync;

  // ✏️ Cập nhật lớp
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      classApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class", variables.id] });
    },
  }).mutateAsync;

  // 🗑 Xóa lớp
  const remove = useMutation({
    mutationFn: (id: string) => classApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  }).mutateAsync;

  // 🏫 Gán phòng cho lớp
  const assignRoom = useMutation({
    mutationFn: ({ classId, roomId }: { classId: string; roomId: string | null }) =>
      classApi.assignRoom(classId, roomId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class", variables.classId] });
    },
  }).mutateAsync;

  return {
    classes,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
    assignRoom,
  };
}

/**
 * Hook để lấy chi tiết một lớp
 */
export function useClass(id?: string) {
  return useQuery({
    queryKey: ["class", id],
    queryFn: () => (id ? classApi.getById(id) : null),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook để tự động gán phòng cho lớp
 */
export function useAutoAssignRooms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, reassignAll }: { year?: string; reassignAll?: boolean }) =>
      classApi.autoAssignRooms(year, reassignAll),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

/**
 * Hook để tự động gán giáo viên chủ nhiệm
 */
export function useAutoAssignHomeroomTeachers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, reassignAll }: { year?: string; reassignAll?: boolean }) =>
      classApi.autoAssignHomeroomTeachers(year, reassignAll),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}


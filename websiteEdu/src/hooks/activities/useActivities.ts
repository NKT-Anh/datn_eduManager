import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { activityApi } from "@/services/activityApi";
import { Activity, ActivityInput } from "@/types/class";

/**
 * Hook để quản lý hoạt động (Activities)
 * - Lấy danh sách hoạt động
 * - Lấy chi tiết hoạt động
 * - Tạo, cập nhật, xóa hoạt động
 */
export function useActivities() {
  const queryClient = useQueryClient();

  // 📘 Lấy danh sách tất cả hoạt động
  const {
    data: activities = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["activities"],
    queryFn: () => activityApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 phút
  });

  // ➕ Tạo hoạt động mới
  const create = useMutation({
    mutationFn: (data: ActivityInput) => activityApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  }).mutateAsync;

  // ✏️ Cập nhật hoạt động
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActivityInput }) =>
      activityApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.id] });
    },
  }).mutateAsync;

  // 🗑 Xóa hoạt động
  const remove = useMutation({
    mutationFn: (id: string) => activityApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  }).mutateAsync;

  return {
    activities,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
  };
}

/**
 * Hook để lấy chi tiết một hoạt động
 */
export function useActivity(id?: string) {
  return useQuery({
    queryKey: ["activity", id],
    queryFn: () => (id ? activityApi.getById(id) : null),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}









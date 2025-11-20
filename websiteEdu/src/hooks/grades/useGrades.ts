import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gradeApi } from "@/services/gradeApi";

/**
 * Hook để quản lý khối lớp (Grades)
 * - Lấy danh sách khối
 * - Tạo, cập nhật, xóa khối
 */
export function useGrades() {
  const queryClient = useQueryClient();

  // 📘 Lấy danh sách khối
  const {
    data: grades = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["grades"],
    queryFn: () => gradeApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 phút
  });

  // ➕ Tạo khối mới
  const create = useMutation({
    mutationFn: (data: any) => gradeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    },
  }).mutateAsync;

  // ✏️ Cập nhật khối
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      gradeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    },
  }).mutateAsync;

  // 🗑 Xóa khối
  const remove = useMutation({
    mutationFn: (id: string) => gradeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    },
  }).mutateAsync;

  return {
    grades,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
  };
}


import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolYearApi } from "@/services/schoolYearApi";

/**
 * Hook để quản lý năm học (School Years)
 * - Lấy danh sách năm học
 * - Tạo, cập nhật, xóa năm học
 */
export function useSchoolYears() {
  const queryClient = useQueryClient();

  // 📘 Lấy danh sách tất cả năm học
  const {
    data: schoolYears = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["schoolYears"],
    queryFn: () => schoolYearApi.getAll(),
    staleTime: 10 * 60 * 1000, // 10 phút (năm học ít thay đổi)
  });

  // ➕ Tạo năm học mới
  const create = useMutation({
    mutationFn: (data: any) => schoolYearApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolYears"] });
    },
  }).mutateAsync;

  // ✏️ Cập nhật năm học
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      schoolYearApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolYears"] });
    },
  }).mutateAsync;

  // 🗑 Xóa năm học
  const remove = useMutation({
    mutationFn: (id: string) => schoolYearApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolYears"] });
    },
  }).mutateAsync;

  // 🔄 Kích hoạt năm học
  const activate = useMutation({
    mutationFn: (id: string) => schoolYearApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolYears"] });
    },
  }).mutateAsync;

  // 🚫 Ngừng kích hoạt năm học
  const deactivate = useMutation({
    mutationFn: (id: string) => schoolYearApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolYears"] });
    },
  }).mutateAsync;

  // 📊 Cập nhật trạng thái năm học
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'upcoming' | 'active' | 'inactive' }) =>
      schoolYearApi.updateSchoolYearStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolYears"] });
    },
  }).mutateAsync;

  return {
    schoolYears,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
    activate,
    deactivate,
    updateStatus,
  };
}

/**
 * Hook để lấy năm học hiện tại
 */
export function useCurrentSchoolYear() {
  const { data: schoolYears = [] } = useSchoolYears();
  const currentYear = schoolYears.find((y: any) => y.isActive);
  return { currentYear, schoolYears };
}


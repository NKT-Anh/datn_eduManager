import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assignmentApi } from "@/services/assignmentApi";
import {
  TeachingAssignment,
  TeachingAssignmentPayload,
} from "@/types/class";

/**
 * Hook để quản lý phân công giảng dạy (Teaching Assignments)
 * - Lấy danh sách phân công
 * - Lấy phân công theo giáo viên
 * - Tạo, cập nhật, xóa phân công
 * - Tạo hàng loạt phân công
 */
export function useAssignments(params?: {
  year?: string;
  semester?: string;
}) {
  const queryClient = useQueryClient();

  // 📘 Lấy danh sách tất cả phân công (filter theo năm học ở backend)
  const {
    data: assignments = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["assignments", params],
    queryFn: () => assignmentApi.getAll({ year: params?.year }),
    select: (data) => {
      // Lọc theo semester nếu có (frontend filter)
      if (!params?.semester) return data;
      return data.filter((a) => a.semester === params.semester);
    },
    staleTime: 2 * 60 * 1000, // 2 phút
  });

  // ➕ Tạo phân công mới
  const create = useMutation({
    mutationFn: (data: TeachingAssignmentPayload) =>
      assignmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  }).mutateAsync;

  // ✏️ Cập nhật phân công
  const update = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: TeachingAssignmentPayload;
    }) => assignmentApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignment", variables.id] });
    },
  }).mutateAsync;

  // 🗑 Xóa phân công
  const remove = useMutation({
    mutationFn: (id: string) => assignmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  }).mutateAsync;

  // 📦 Tạo hàng loạt phân công
  const createBulk = useMutation({
    mutationFn: (data: TeachingAssignmentPayload[]) =>
      assignmentApi.createBulk(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  }).mutateAsync;

  return {
    assignments,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
    createBulk,
  };
}

/**
 * Hook để lấy phân công theo giáo viên
 */
export function useAssignmentsByTeacher(
  teacherId?: string,
  params?: { year?: string; semester?: string }
) {
  return useQuery({
    queryKey: ["assignments", "teacher", teacherId, params],
    queryFn: () =>
      teacherId ? assignmentApi.getByTeacher(teacherId, params) : [],
    enabled: !!teacherId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook để lấy chi tiết một phân công
 */
export function useAssignment(id?: string) {
  return useQuery({
    queryKey: ["assignment", id],
    queryFn: () => (id ? assignmentApi.getById(id) : null),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}


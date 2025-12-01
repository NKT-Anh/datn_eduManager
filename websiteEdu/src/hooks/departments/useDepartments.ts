import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { departmentApi } from "@/services/departmentApi";
import { Department, DepartmentInput, DepartmentStats } from "@/types/department";
import { Teacher } from "@/types/auth";
import { Subject } from "@/types/class";

/**
 * Hook để quản lý tổ bộ môn (Departments)
 * - Lấy danh sách tổ bộ môn
 * - Lấy chi tiết tổ bộ môn
 * - Tạo, cập nhật, xóa tổ bộ môn
 * - Quản lý giáo viên và môn học trong tổ
 * @param year - Năm học (optional, nếu có sẽ filter theo năm học)
 */
export function useDepartments(year?: string) {
  const queryClient = useQueryClient();

  // 📘 Lấy danh sách tổ bộ môn (theo năm học nếu có)
  const {
    data: departments = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["departments", year],
    queryFn: () => departmentApi.getAll(year ? { year } : undefined),
    staleTime: 5 * 60 * 1000, // 5 phút
  });

  // ➕ Tạo tổ bộ môn mới
  const create = useMutation({
    mutationFn: (data: DepartmentInput) => departmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  }).mutateAsync;

  // ✏️ Cập nhật tổ bộ môn
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DepartmentInput> }) =>
      departmentApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["department", variables.id] });
    },
  }).mutateAsync;

  // 🗑 Xóa tổ bộ môn
  const remove = useMutation({
    mutationFn: (id: string) => departmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  }).mutateAsync;

  return {
    departments,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
  };
}

/**
 * Hook để lấy chi tiết một tổ bộ môn
 */
export function useDepartment(id: string | undefined) {
  const {
    data: department,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["department", id],
    queryFn: () => departmentApi.getById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    department,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook để lấy danh sách giáo viên trong tổ bộ môn
 * @param departmentId - ID của tổ bộ môn
 * @param year - Năm học (optional, nếu có sẽ lấy giáo viên theo yearRoles)
 */
export function useDepartmentTeachers(departmentId: string | undefined, year?: string) {
  const queryClient = useQueryClient();
  
  const {
    data: teachers = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["department", departmentId, "teachers", year],
    queryFn: () => departmentApi.getTeachers(departmentId!, year ? { year } : undefined),
    enabled: !!departmentId,
    staleTime: 2 * 60 * 1000, // 2 phút
  });

  // ➕ Thêm giáo viên vào tổ
  const addTeacher = useMutation({
    mutationFn: (teacherId: string) =>
      departmentApi.addTeacher(departmentId!, teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department", departmentId, "teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  }).mutateAsync;

  // ➖ Xóa giáo viên khỏi tổ
  const removeTeacher = useMutation({
    mutationFn: (teacherId: string) =>
      departmentApi.removeTeacher(departmentId!, teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department", departmentId, "teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  }).mutateAsync;

  return {
    teachers,
    isLoading,
    error,
    refetch,
    addTeacher,
    removeTeacher,
  };
}

/**
 * Hook để lấy danh sách môn học trong tổ bộ môn
 */
export function useDepartmentSubjects(departmentId: string | undefined) {
  const {
    data: subjects = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["department", departmentId, "subjects"],
    queryFn: () => departmentApi.getSubjects(departmentId!),
    enabled: !!departmentId,
    staleTime: 2 * 60 * 1000, // 2 phút
  });

  return {
    subjects,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook để lấy thống kê tổ bộ môn
 */
export function useDepartmentStats(departmentId: string | undefined) {
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["department", departmentId, "stats"],
    queryFn: () => departmentApi.getStats(departmentId!),
    enabled: !!departmentId,
    staleTime: 2 * 60 * 1000, // 2 phút
  });

  return {
    stats,
    isLoading,
    error,
    refetch,
  };
}


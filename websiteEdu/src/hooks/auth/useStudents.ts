import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import studentApi, {
  StudentCreatePayload,
  StudentUpdatePayload,
} from "@/services/studentApi";

/* =========================================================
   📘 Hook chính: useStudents()
   → Lấy danh sách học sinh + CRUD (tạo, sửa, xóa)
========================================================= */
export function useStudents(params?: Record<string, any>) {
  const queryClient = useQueryClient();

  // 🧠 Lấy danh sách học sinh
  const {
    data: students = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["students", params],
    queryFn: () => studentApi.getAll(params),
    select: (res) => res?.data || res || [], // ✅ chuyển axios response thành mảng luôn
  });


  // ➕ Tạo học sinh
  const create = useMutation({
    mutationFn: (payload: StudentCreatePayload) => studentApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  }).mutateAsync;

  // 🛠 Cập nhật học sinh
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StudentUpdatePayload }) =>
      studentApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", variables.id] });
    },
  }).mutateAsync;

  // 🗑 Xóa học sinh
  const remove = useMutation({
    mutationFn: (id: string) => studentApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  }).mutateAsync;
  // 🧮 Phân lớp tự động (từ frontend)
const autoAssign = useMutation({
  mutationFn: (year: string) => studentApi.autoAssignToClasses(year),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["students"] });
  },
}).mutateAsync;

  return {
    students,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
    autoAssign,
  };
}

/* =========================================================
   📘 Hook phụ: useStudent()
   → Lấy chi tiết 1 học sinh (chi tiết riêng lẻ)
========================================================= */
export function useStudent(id?: string) {
  return useQuery({
    queryKey: ["student", id],
    queryFn: () => (id ? studentApi.getById(id) : null),
    enabled: !!id,
  });
}

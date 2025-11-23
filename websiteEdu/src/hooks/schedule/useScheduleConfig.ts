import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getScheduleConfig, saveScheduleConfig } from "@/services/scheduleConfigApi";
import { ScheduleConfig } from "@/types/schedule";

/**
 * Hook để quản lý cấu hình thời khóa biểu (ScheduleConfig)
 * - Lấy cấu hình thời khóa biểu
 * - Lưu/cập nhật cấu hình
 */
export function useScheduleConfig() {
  const queryClient = useQueryClient();

  // 📘 Lấy cấu hình thời khóa biểu
  const {
    data: scheduleConfig,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["scheduleConfig"],
    queryFn: () => getScheduleConfig(),
    staleTime: 5 * 60 * 1000, // 5 phút
  });

  // 💾 Lưu/cập nhật cấu hình
  const save = useMutation({
    mutationFn: (config: ScheduleConfig) => saveScheduleConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduleConfig"] });
    },
  }).mutateAsync;

  return {
    scheduleConfig,
    isLoading,
    error,
    refetch,
    save,
  };
}









import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import profileApi from "@/services/profileApi";

/* =========================================================
   🧠 Hook: Lấy thông tin cá nhân
========================================================= */
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: profileApi.getProfile,
  });
}

/* =========================================================
   ✏️ Hook: Cập nhật hồ sơ người dùng
========================================================= */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => profileApi.updateProfile(data),
    onSuccess: () => {
      // Làm mới cache sau khi cập nhật thành công
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/* =========================================================
   🔑 Hook: Đổi mật khẩu
========================================================= */
export function useChangePassword() {
  return useMutation({
    mutationFn: (newPassword: string) => profileApi.changePassword(newPassword),
  });
}

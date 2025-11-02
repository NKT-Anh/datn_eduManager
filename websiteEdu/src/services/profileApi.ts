import api from './axiosInstance';

const profileApi = {
  // 🧠 Lấy thông tin cá nhân
  getProfile: () => api.get('/profile').then(res => res.data),

  // ✏️ Cập nhật thông tin cá nhân
  updateProfile: (data: any) => api.put('/profile', data).then(res => res.data),

  // 🔑 Đổi mật khẩu
  changePassword: (newPassword: string) =>
    api.post('/profile/change-password', { newPassword }).then(res => res.data),
};

export default profileApi;

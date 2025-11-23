import axios from 'axios';
import { getAuth } from 'firebase/auth';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL as string;

export const api = axios.create({
  baseURL: API_BASE_URL,
    timeout: 5000,
});

// Gắn Authorization: Bearer <Firebase ID Token> nếu đã lưu trong localStorage
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('backendUser');
    if (stored) {
      const parsed = JSON.parse(stored);
      const idToken = parsed?.idToken;
      if (idToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${idToken}`;
      }
    }
  } catch {}
  return config;
});

// Đổi Firebase ID Token lấy thông tin backend (role, uid, jwt nếu có)
export const getToken = async () => {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('User chưa đăng nhập hoặc chưa lấy được Firebase ID Token');
  const res = await api.post('/auth', {}, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return res.data; // { message, role, uid, jwt? }
};

// Kiểm tra role từ backend (yêu cầu header Authorization: Bearer <ID_TOKEN>)
export const checkRole = async () => {
  const res = await api.get('/auth/check-role');
  return res.data as { role: string; uid: string };
};

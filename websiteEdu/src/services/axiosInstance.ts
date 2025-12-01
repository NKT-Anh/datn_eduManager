
import axios from "axios";
import { getAuth, getIdToken } from "firebase/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Log để debug
console.log('🔧 API Base URL:', API_BASE_URL);

// 🧩 Gắn token Firebase - Luôn lấy token mới từ Firebase để đảm bảo không hết hạn
api.interceptors.request.use(
  async (config) => {
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        try {
          // ✅ Luôn lấy token mới từ Firebase để đảm bảo không hết hạn
          const freshToken = await getIdToken(auth.currentUser, false); // Không force refresh để tránh delay
          
          if (freshToken) {
            config.headers.Authorization = `Bearer ${freshToken}`;
            
            // ✅ Cập nhật token trong localStorage để dùng cho lần sau
            const backendUser = localStorage.getItem("backendUser");
            if (backendUser) {
              try {
                const userData = JSON.parse(backendUser);
                userData.idToken = freshToken;
                localStorage.setItem("backendUser", JSON.stringify(userData));
              } catch (err) {
                console.warn('Không thể cập nhật token trong localStorage:', err);
              }
            }
          }
        } catch (err) {
          console.warn('Không thể lấy token từ Firebase:', err);
          // ✅ Fallback: thử dùng token trong localStorage nếu có
          const backendUser = localStorage.getItem("backendUser");
          if (backendUser) {
            try {
              const { idToken } = JSON.parse(backendUser);
              if (idToken) {
                config.headers.Authorization = `Bearer ${idToken}`;
              }
            } catch (parseErr) {
              console.warn('Invalid backendUser data:', parseErr);
            }
          }
        }
      } else {
        // ✅ Nếu không có user đăng nhập, thử dùng token trong localStorage
        const backendUser = localStorage.getItem("backendUser");
        if (backendUser) {
          try {
            const { idToken } = JSON.parse(backendUser);
            if (idToken) {
              config.headers.Authorization = `Bearer ${idToken}`;
            }
          } catch (err) {
            console.warn('Invalid backendUser data:', err);
          }
        }
      }

      // ✅ Gắn năm học hiện tại từ backendUser vào header x-school-year (nếu có)
      try {
        const raw = localStorage.getItem('backendUser');
        if (raw) {
          const parsed = JSON.parse(raw);
          const currentSchoolYear = parsed?.currentSchoolYear;
          if (
            currentSchoolYear &&
            !config.headers['x-school-year'] &&
            !config.headers['x-school-year-code']
          ) {
            (config.headers as any)['x-school-year'] = String(currentSchoolYear);
          }
        }
      } catch (err) {
        console.warn('Không thể gắn x-school-year từ backendUser:', err);
      }
    } catch (err) {
      console.warn('Lỗi khi gắn token:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🚨 Xử lý lỗi 401 tự động - Refresh token nếu hết hạn
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 và chưa retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Nếu đang refresh, đợi
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // ✅ Luôn thử refresh token khi gặp lỗi 401
        const auth = getAuth();
        if (auth.currentUser) {
          const freshToken = await getIdToken(auth.currentUser, true); // Force refresh
          
          // Cập nhật localStorage
          const backendUser = localStorage.getItem("backendUser");
          if (backendUser) {
            try {
              const userData = JSON.parse(backendUser);
              userData.idToken = freshToken;
              localStorage.setItem("backendUser", JSON.stringify(userData));
            } catch (err) {
              console.warn('Không thể cập nhật token trong localStorage');
            }
          }

          // Retry request với token mới
          originalRequest.headers.Authorization = `Bearer ${freshToken}`;
          processQueue(null, freshToken);
          isRefreshing = false;
          
          return api(originalRequest);
        } else {
          // Không có user, redirect về login
          processQueue(new Error('User không tồn tại'));
          isRefreshing = false;
          localStorage.removeItem('backendUser');
          // Chỉ redirect nếu không phải đang ở trang login
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      } catch (refreshError) {
        // Refresh token thất bại, redirect về login
        processQueue(refreshError);
        isRefreshing = false;
        localStorage.removeItem('backendUser');
        // Chỉ redirect nếu không phải đang ở trang login
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

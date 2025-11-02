// import axios from "axios";

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// // Tạo instance chung cho toàn hệ thống
// const api = axios.create({
//   baseURL: API_BASE_URL,
// });

// // Thêm interceptor để tự động đính kèm token Firebase
// api.interceptors.request.use(
//   (config) => {
//     const backendUser = localStorage.getItem("backendUser");
//     if (backendUser) {
//       const { idToken } = JSON.parse(backendUser);
//       if (idToken) {
//         config.headers.Authorization = `Bearer ${idToken}`;
//       }
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// export default api;

import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🧩 Gắn token Firebase
api.interceptors.request.use(
  (config) => {
    try {
      const backendUser = localStorage.getItem("backendUser");
      if (backendUser) {
        const { idToken } = JSON.parse(backendUser);
        if (idToken) {
          config.headers.Authorization = `Bearer ${idToken}`;
        }
      }
    } catch (err) {
      console.warn('Invalid backendUser data');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🚨 Xử lý lỗi 401 tự động
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('backendUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

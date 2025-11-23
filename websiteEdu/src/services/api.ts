// src/services/api.ts
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL;

// Tạo instance axios
export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Middleware: tự động gắn token vào header
api.interceptors.request.use(
  (config) => {
    try {
      const raw = localStorage.getItem("backendUser");
      if (raw) {
        const parsed = JSON.parse(raw);
        const idToken = parsed?.idToken;

        if (idToken) {
          if (config.headers) {
            // Nếu headers là AxiosHeaders
            (config.headers as any).set?.("Authorization", `Bearer ${idToken}`);
          } else {
            config.headers = { Authorization: `Bearer ${idToken}` } as any;
          }
        
        } else {
          console.warn("⚠️ Không tìm thấy idToken trong localStorage");
        }
      } else {
        console.warn("⚠️ Không có backendUser trong localStorage");
      }
    } catch (err) {
      console.error("Lỗi khi parse backendUser:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Test kết nối backend
export const checkBackendConnection = async (): Promise<boolean> => {
  try {
    await api.get("/mongo-status");
    console.log("✅ Kết nối thành công với MongoDB qua backend!");
    return true;
  } catch (error) {
    console.error("❌ Không thể kết nối với MongoDB hoặc backend:", error);
    return false;
  }
};

// API: lấy thông tin user hiện tại
export const getMe = async () => {
  const res = await api.get("/accounts/me");
  return res.data; // { uid, email, role, ... }
};

// API: check role
export const checkRole = async () => {
  const res = await api.get("/accounts/check-role");
  return res.data; // { role, uid }
};

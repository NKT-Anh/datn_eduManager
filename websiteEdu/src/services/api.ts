// // src/services/api.ts
// // ✅ Tất cả API frontend bây giờ dùng chung instance từ axiosInstance.ts
// import axiosClient from "./axiosInstance";

// export const api = axiosClient;

// // Test kết nối backend
// export const checkBackendConnection = async (): Promise<boolean> => {
//   try {
//     await api.get("/mongo-status");
//     console.log("✅ Kết nối thành công với MongoDB qua backend!");
//     return true;
//   } catch (error) {
//     console.error("❌ Không thể kết nối với MongoDB hoặc backend:", error);
//     return false;
//   }
// };

// // API: lấy thông tin user hiện tại
// export const getMe = async () => {
//   const res = await api.get("/accounts/me");
//   return res.data; // { uid, email, role, ... }
// };

// // API: check role
// export const checkRole = async () => {
//   const res = await api.get("/accounts/check-role");
//   return res.data; // { role, uid }
// };

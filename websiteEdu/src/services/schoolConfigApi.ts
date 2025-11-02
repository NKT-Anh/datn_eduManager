import api from "./axiosInstance";

// 🏫 Quản lý cấu hình năm học & học kỳ
const schoolConfigApi = {
  /**
   * Lấy danh sách năm học
   * @returns Promise<{ code: string, name: string }[]>
   */
  getSchoolYears: () => api.get("/school-config/school-years"),

  /**
   * Lấy danh sách học kỳ
   * @returns Promise<{ code: string, name: string }[]>
   */
  getSemesters: () => api.get("/school-config/semesters"),
};

export default schoolConfigApi;

import api from "./axiosInstance";

// 🏫 Quản lý cấu hình năm học, học kỳ & khối học
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

  /**
   * Lấy danh sách khối học
   * @returns Promise<{ code: string, name: string }[]>
   */
  getGrades: () => api.get("/school-config/grades"),
};

export default schoolConfigApi;

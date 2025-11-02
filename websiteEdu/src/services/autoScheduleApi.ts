import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const autoScheduleApi = {
  // 🧩 Tự động tạo thời khóa biểu
  generateSchedule: async (
    grades: string[],
    year: string,
    semester: string,
    includeActivities: boolean = true
  ) => {
    console.log("➡️ Gọi API /auto-schedule/generate với dữ liệu:", {
      grades,
      year,
      semester,
      includeActivities,
    });
    const res = await axios.post(`${API_BASE}/auto-schedule/generate`, {
      grades,
      year,
      semester,
      includeActivities,
    });
    return res.data;
  },

  // 🔄 Kéo thả đổi tiết
  updateByDragDrop: async (data: {
    classId: string;
    year: string;
    semester: string;
    fromDay: string;
    fromPeriod: number;
    toDay: string;
    toPeriod: number;
  }) => {
    const res = await axios.put(`${API_BASE}/auto-schedule/drag-drop`, data);
    return res.data;
  },

  // 🏫 Tạo lớp tự động
  createClasses: async (
    grades: string[],
    year: string,
    classesPerGrade: number = 8,
    capacity: number = 45
  ) => {
    const res = await axios.post(`${API_BASE}/auto-schedule/create-classes`, {
      grades,
      year,
      classesPerGrade,
      capacity,
    });
    return res.data;
  },

  // 🧾 Lấy danh sách hoạt động
  getActiveActivities: async () => {
    const res = await axios.get(`${API_BASE}/activities/active`);
    return res.data;
  },

  /**
   * 🧠 Tự động kiểm tra trùng giáo viên giữa các lớp trong học kỳ
   * @param year - Năm học (VD: "2024-2025")
   * @param semester - Học kỳ (VD: "HK1")
   * @returns Danh sách trùng hoặc rỗng nếu không có
   */
  checkTeacherConflicts: async (year: string, semester: string) => {
    console.log("🔍 Kiểm tra trùng giáo viên:", { year, semester });
    const res = await axios.get(`${API_BASE}/auto-schedule/check-conflicts`, {
      params: { year, semester },
    });
    return res.data;
  },
};

import axios from "axios";
import { SchedulePayload } from "@/types/schedule";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const scheduleApi = {
  getAllSchedules: async () => {
    const res = await axios.get(`${API_BASE}/schedules`);
    return res.data;
  },

  getScheduleByClass: async (classId: string, year: string, semester: string) => {
    const res = await axios.get(`${API_BASE}/schedules/${classId}/${year}/${semester}`);
    return res.data;
  },

  saveSchedule: async (payload: SchedulePayload) => {
    const res = await axios.post(`${API_BASE}/schedules`, payload);
    return res.data;
  },

  updateSchedule: async (id: string, payload: Partial<SchedulePayload>) => {
    const res = await axios.put(`${API_BASE}/schedules/${id}`, payload);
    return res.data;
  },

  deleteSchedule: async (id: string) => {
    const res = await axios.delete(`${API_BASE}/schedules/${id}`);
    return res.data;
  },
   deleteByGradeYearSemester: async (year: string, semester: string, grade: string) => {
  const res = await axios.post(`${API_BASE}/schedules/delete-by-grade-year-semester`, {
    year,
    semester,
    grade,
  });
  return res.data;
  
},
  getSchedulesByYearSemester: async (year: string, semester: string) => {
    const res = await axios.get(`${API_BASE}/schedules/year/${year}/semester/${semester}`);
    return res.data;
  },

  // 🆕 🧩 Lấy theo Khối + Năm + Học kỳ
  getSchedulesByGrade: async (grade: string, year: string, semester: string) => {
    const res = await axios.get(`${API_BASE}/schedules/grade/${grade}/year/${year}/semester/${semester}`);
    return res.data;
  },
saveOrUpdateSchedule: async (payload: SchedulePayload) => {
  try {
    const { classId, year, semester, timetable } = payload;

    // 1️⃣ Lấy toàn bộ TKB trong cùng năm học + học kỳ
    const allSchedules = await scheduleApi.getSchedulesByYearSemester(year, semester);

    // 🧩 Các tên giáo viên hoặc môn cần bỏ qua khi kiểm tra trùng
    const ignoreTeachers = ["Hoạt động", "Chào cờ", "Sinh hoạt", "Thể dục toàn trường"];
    const conflicts: { teacher: string; day: string; period: number; className: string }[] = [];

    // 2️⃣ Kiểm tra trùng giáo viên (chỉ check giáo viên không nằm trong danh sách ignore)
    for (const dayEntry of timetable) {
      for (const period of dayEntry.periods) {
        if (!period?.teacher) continue;

        // 👉 Bỏ qua nếu là giáo viên/môn hoạt động chung
        if (ignoreTeachers.some(t => period.teacher.toLowerCase().includes(t.toLowerCase()))) {
          continue;
        }

        for (const other of allSchedules) {
          if (other.classId === classId) continue; // bỏ qua chính lớp hiện tại

          const otherDay = other.timetable.find((d: any) => d.day === dayEntry.day);
          if (!otherDay) continue;

          const samePeriod = otherDay.periods.find(
            (p: any) =>
              p.period === period.period &&
              p.teacher &&
              p.teacher === period.teacher &&
              !ignoreTeachers.some(t => p.teacher.toLowerCase().includes(t.toLowerCase()))
          );

          if (samePeriod) {
            conflicts.push({
              teacher: period.teacher,
              day: dayEntry.day,
              period: period.period,
              className: other.className,
            });
          }
        }
      }
    }

    // 3️⃣ Nếu có trùng -> báo lỗi
    if (conflicts.length > 0) {
      console.warn("❌ Trùng giáo viên:", conflicts);
      throw new Error(
        `Phát hiện trùng giáo viên:\n${conflicts
          .map(
            (c) =>
              `• GV ${c.teacher} trùng tiết ${c.period} (${c.day}) với lớp ${c.className}`
          )
          .join("\n")}`
      );
    }

    // 4️⃣ Không trùng -> lưu như cũ
    const existing = await scheduleApi.getScheduleByClass(classId, year, semester);

    if (existing && existing._id) {
      const updated = await scheduleApi.updateSchedule(existing._id, payload);
      return { message: "✅ Đã cập nhật thời khóa biểu thành công!", data: updated };
    } else {
      const created = await scheduleApi.saveSchedule(payload);
      return { message: "✅ Đã tạo mới thời khóa biểu thành công!", data: created };
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      const created = await scheduleApi.saveSchedule(payload);
      return { message: "✅ Đã tạo mới thời khóa biểu thành công!", data: created };
    }
    console.error("❌ Lỗi khi lưu hoặc cập nhật thời khóa biểu:", error);
    throw error;
  }
},


};

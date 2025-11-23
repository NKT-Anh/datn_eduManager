import axios from "axios";
import { ScheduleConfig, SubjectHour } from "@/types/schedule";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// 👉 Lấy cấu hình thời khóa biểu
export const getScheduleConfig = async (): Promise<ScheduleConfig> => {
  const { data } = await axios.get(`${API_BASE}/scheduleConfig`);
  return data;
};

// 👉 Upsert (tạo hoặc cập nhật toàn bộ config)
export const saveScheduleConfig = async (config: ScheduleConfig): Promise<ScheduleConfig> => {
  const { data } = await axios.post(`${API_BASE}/scheduleConfig`, config);
  return data.config ?? data; // backend trả { message, config }
};

// 👉 Cập nhật riêng 1 ngày (thứ 2–7)
export const updateDayConfig = async (
  day: string,
  payload: { totalPeriods?: number; morningPeriods?: number }
): Promise<ScheduleConfig> => {
  const { data } = await axios.patch(`${API_BASE}/scheduleConfig/day/${day}`, payload);
  return data.config ?? data;
};

// 👉 Cập nhật số tiết / tuần cho từng môn học (theo object mới)
export const updateSubjectHours = async (
  subjectHours: Record<string, Partial<SubjectHour>>
): Promise<Record<string, SubjectHour>> => {
  /**
   * subjectHours = {
   *   "Toán": { periodsPerWeek: 4, maxPeriodsPerDay: 2, allowConsecutive: true, session: "main" },
   *   "Văn": { periodsPerWeek: 3 }
   * }
   */
  const { data } = await axios.patch(`${API_BASE}/scheduleConfig/subject-hours`, { subjectHours });
  return data.subjectHours ?? data;
};

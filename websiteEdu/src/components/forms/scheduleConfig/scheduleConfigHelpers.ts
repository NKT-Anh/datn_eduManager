/**
 * Helper functions cho ScheduleConfigForm
 */

export const WEEKDAYS = [
  { key: "Monday", label: "Thứ 2" },
  { key: "Tuesday", label: "Thứ 3" },
  { key: "Wednesday", label: "Thứ 4" },
  { key: "Thursday", label: "Thứ 5" },
  { key: "Friday", label: "Thứ 6" },
  { key: "Saturday", label: "Thứ 7" },
];

/**
 * Lấy số tiết mặc định cho môn học
 */
export function getDefaultPeriodsPerWeek(subjectName: string): Record<"10" | "11" | "12", number> {
  const name = subjectName.toLowerCase();
  const defaultMap: Record<string, Record<"10" | "11" | "12", number>> = {
    'toán': { "10": 4, "11": 4, "12": 4 },
    'ngữ văn': { "10": 4, "11": 4, "12": 4 },
    'văn': { "10": 4, "11": 4, "12": 4 },
    'tiếng anh': { "10": 3, "11": 3, "12": 3 },
    'anh': { "10": 3, "11": 3, "12": 3 },
    'vật lý': { "10": 2, "11": 2, "12": 2 },
    'hóa học': { "10": 2, "11": 2, "12": 2 },
    'hóa': { "10": 2, "11": 2, "12": 2 },
    'sinh học': { "10": 2, "11": 2, "12": 2 },
    'sinh': { "10": 2, "11": 2, "12": 2 },
    'lịch sử': { "10": 2, "11": 2, "12": 2 },
    'địa lý': { "10": 2, "11": 2, "12": 2 },
    'địa': { "10": 2, "11": 2, "12": 2 },
    'giáo dục công dân': { "10": 1, "11": 1, "12": 1 },
    'gdcd': { "10": 1, "11": 1, "12": 1 },
    'thể dục': { "10": 2, "11": 2, "12": 2 },
    'công nghệ': { "10": 1, "11": 1, "12": 1 },
    'tin học': { "10": 1, "11": 1, "12": 1 },
    'tin': { "10": 1, "11": 1, "12": 1 },
  };
  
  for (const [key, value] of Object.entries(defaultMap)) {
    if (name.includes(key)) {
      return value;
    }
  }
  
  return { "10": 2, "11": 2, "12": 2 }; // Mặc định
}

/**
 * Kiểm tra môn có cho phép tiết liên tiếp không (chỉ Toán và Ngữ văn)
 */
export function shouldAllowConsecutive(subjectName: string): boolean {
  const name = subjectName.toLowerCase();
  return name.includes('toán') || name.includes('ngữ văn') || name.includes('văn');
}

/**
 * Lấy số tiết mặc định cho hoạt động
 */
export function getDefaultActivityPeriods(activityName: string): Record<"10" | "11" | "12", number> {
  // Mặc định: 2 tiết/tuần cho tất cả hoạt động
  return { "10": 2, "11": 2, "12": 2 };
}

/**
 * Tính tổng số tiết học chính / tuần cho từng khối
 */
export function getWeeklyPeriodTotalsByGrade(
  grade: "10" | "11" | "12",
  subjectHours: Record<string, any>,
  activities: any[]
) {
  // Môn học chính
  const subjectsMain = Object.entries(subjectHours || {}).filter(
    ([, rule]: any) => rule.session === "main"
  );
  const totalSubjectMain = subjectsMain.reduce(
    (sum, [, rule]: any) => {
      if (typeof rule.periodsPerWeek === 'object' && rule.periodsPerWeek !== null) {
        return sum + (rule.periodsPerWeek[grade] || 0);
      } else if (typeof rule.periodsPerWeek === 'number') {
        return sum + rule.periodsPerWeek;
      }
      return sum;
    },
    0
  );

  // Hoạt động chính
  const activitiesMain = (activities || []).filter((a: any) => a.session === "main");
  const totalActivityMain = activitiesMain.reduce(
    (sum: number, a: any) => {
      if (typeof a.periodsPerWeek === 'object' && a.periodsPerWeek !== null) {
        return sum + (a.periodsPerWeek[grade] || 0);
      } else if (typeof a.periodsPerWeek === 'number') {
        return sum + a.periodsPerWeek;
      }
      return sum;
    },
    0
  );

  const totalAll = totalSubjectMain + totalActivityMain;
  return { totalSubjectMain, totalActivityMain, totalAll };
}









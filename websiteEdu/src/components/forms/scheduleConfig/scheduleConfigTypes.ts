/**
 * Types cho ScheduleConfigForm
 */

export interface ScheduleConfigFormData {
  defaultStartTimeMorning: string;
  defaultStartTimeAfternoon: string;
  minutesPerPeriod: number;
  defaultBreakMinutes: number;
  specialBreaks?: Array<{
    period: number;
    minutes: number;
    session: "morning" | "afternoon";
  }>;
  subjectHours?: Record<string, SubjectHourConfig>;
  days?: Array<DayConfig>;
  gradeSessionRules?: Array<GradeSessionRule>;
  activities?: Array<ActivityConfig>;
}

export interface SubjectHourConfig {
  periodsPerWeek: number | Record<"10" | "11" | "12", number>;
  maxPeriodsPerDay: number;
  allowConsecutive: boolean;
  session: "main" | "extra";
  gradeConfigs?: Record<"10" | "11" | "12", GradeConfig>;
}

export interface DayConfig {
  dayKey: string;
  label: string;
  morningPeriods: number;
  afternoonPeriods: number;
  totalPeriods: number;
}

export interface GradeSessionRule {
  grade: "10" | "11" | "12";
  session: "morning" | "afternoon" | "both";
}

export interface ActivityConfig {
  activityId: string;
  periodsPerWeek: number | Record<"10" | "11" | "12", number>;
  session: "main" | "extra";
  isPermanent?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  fixedSlots?: Array<FixedSlot>;
  gradeConfigs?: Record<"10" | "11" | "12", ActivityGradeConfig>;
}

export interface FixedSlot {
  day: string;
  periods: number[];
}

export interface GradeConfig {
  maxPeriodsPerDay?: number;
  allowConsecutive?: boolean;
  session?: "main" | "extra";
}

export interface ActivityGradeConfig extends GradeConfig {
  dayOfWeek?: string;
  timeSlot?: string;
}









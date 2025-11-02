export interface Subject {
  id: string;
  name: string;
  color: string;
  code?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface Period {
  id?: string;
  day: number; // 0-6 (Thứ 2 = 0, Thứ 3 = 1, ...)
  period: number; // 0-based index
  subjectId: string | null;
  teacherId: string | null;
  isFixed?: boolean; // Hoạt động cố định
}

export interface TimetableConfig {
  days: {
    mon: {
      totalPeriods: number;
      morningPeriods: number;
      afternoonPeriods: number;
    };
  };
  defaultStartTimeMorning: string;
  defaultStartTimeAfternoon: string;
  minutesPerPeriod: number;
  defaultBreakMinutes: number;
  specialBreaks: Array<{
    period: number;
    session: 'morning' | 'afternoon';
    minutes: number;
  }>;
}

export interface TimetableData {
  periods: Period[];
  subjects: Subject[];
  teachers: Teacher[];
  config: TimetableConfig;
}


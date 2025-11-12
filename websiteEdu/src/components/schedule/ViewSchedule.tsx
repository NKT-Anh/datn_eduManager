import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, BookOpen, Users } from 'lucide-react';

interface ScheduleData {
  _id?: string;
  classId?: {
    _id: string;
    className: string;
    grade: string;
    classCode?: string;
  };
  className?: string;
  year: string;
  semester: string;
  timetable: {
    day: string;
    periods: {
      period: number;
      subject: string;
      teacher: string;
      periodIndex?: number;
    }[];
  }[];
}

interface ViewScheduleProps {
  schedule: ScheduleData | null;
  loading?: boolean;
  title?: string;
  showClass?: boolean;
  morningPeriods?: number;
  afternoonPeriods?: number;
}

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LABELS_VI = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export const ViewSchedule = ({
  schedule,
  loading = false,
  title,
  showClass = true,
  morningPeriods = 5,
  afternoonPeriods = 5,
}: ViewScheduleProps) => {
  const getDayLabel = (day: string) => {
    const dayLower = day.toLowerCase();
    const index = DAY_LABELS.findIndex(d => d.toLowerCase().includes(dayLower.slice(0, 3)));
    return index >= 0 ? DAY_LABELS_VI[index] : day;
  };

  const getPeriodForDay = (day: string, periodNum: number) => {
    if (!schedule?.timetable) return null;
    const dayEntry = schedule.timetable.find(d => 
      d.day.toLowerCase().includes(day.toLowerCase().slice(0, 3))
    );
    if (!dayEntry) return null;
    return dayEntry.periods.find(p => p.period === periodNum || p.periodIndex === periodNum);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Đang tải thời khóa biểu...</p>
        </CardContent>
      </Card>
    );
  }

  if (!schedule) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Chưa có thời khóa biểu</h3>
          <p className="text-muted-foreground">Thời khóa biểu cho kỳ này chưa được tạo.</p>
        </CardContent>
      </Card>
    );
  }

  const totalPeriods = morningPeriods + afternoonPeriods;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{title || 'Thời khóa biểu'}</CardTitle>
              {showClass && schedule.classId && (
                <p className="text-sm text-muted-foreground mt-1">
                  {schedule.classId.className} - Khối {schedule.classId.grade}
                </p>
              )}
            </div>
          </div>
          <Badge variant="outline">
            {schedule.year} - HK{schedule.semester}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Buổi sáng */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Buổi sáng</h3>
              <Badge variant="secondary" className="ml-2">
                Tiết 1 - {morningPeriods}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2 text-center bg-muted font-semibold">Tiết</th>
                    {DAY_LABELS_VI.map((day, idx) => {
                      const dayKey = DAY_LABELS[idx];
                      return (
                        <th key={dayKey} className="border p-2 text-center bg-muted font-semibold min-w-[150px]">
                          {day}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: morningPeriods }).map((_, i) => {
                    const periodNum = i + 1;
                    return (
                      <tr key={periodNum}>
                        <td className="border p-2 text-center font-medium bg-muted">{periodNum}</td>
                        {DAY_LABELS.map((day) => {
                          const period = getPeriodForDay(day, periodNum);
                          return (
                            <td key={day} className="border p-3 text-center">
                              {period ? (
                                <div className="space-y-1">
                                  <div className="font-semibold text-sm">{period.subject || '-'}</div>
                                  {period.teacher && showClass && (
                                    <div className="text-xs text-muted-foreground">
                                      <Users className="h-3 w-3 inline mr-1" />
                                      {period.teacher}
                                    </div>
                                  )}
                                  {period.className && !showClass && (
                                    <div className="text-xs text-primary font-medium">
                                      {period.className}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Buổi chiều */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Buổi chiều</h3>
              <Badge variant="secondary" className="ml-2">
                Tiết {morningPeriods + 1} - {totalPeriods}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2 text-center bg-muted font-semibold">Tiết</th>
                    {DAY_LABELS_VI.map((day, idx) => {
                      const dayKey = DAY_LABELS[idx];
                      return (
                        <th key={dayKey} className="border p-2 text-center bg-muted font-semibold min-w-[150px]">
                          {day}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: afternoonPeriods }).map((_, i) => {
                    const periodNum = morningPeriods + i + 1;
                    return (
                      <tr key={periodNum}>
                        <td className="border p-2 text-center font-medium bg-muted">{periodNum}</td>
                        {DAY_LABELS.map((day) => {
                          const period = getPeriodForDay(day, periodNum);
                          return (
                            <td key={day} className="border p-3 text-center">
                              {period ? (
                                <div className="space-y-1">
                                  <div className="font-semibold text-sm">{period.subject || '-'}</div>
                                  {period.teacher && showClass && (
                                    <div className="text-xs text-muted-foreground">
                                      <Users className="h-3 w-3 inline mr-1" />
                                      {period.teacher}
                                    </div>
                                  )}
                                  {period.className && !showClass && (
                                    <div className="text-xs text-primary font-medium">
                                      {period.className}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


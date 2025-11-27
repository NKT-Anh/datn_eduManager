import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleApi } from '@/services/scheduleApi';
import { getScheduleConfig } from '@/services/scheduleConfigApi';
import { useSchoolYears } from '@/hooks';
import { Calendar, ChevronLeft, ChevronRight, Loader2, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ScheduleConfig } from '@/types/schedule';

const TeacherWeeklySchedulePage = () => {
  const { backendUser } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const { schoolYears: allSchoolYears, currentYear } = useSchoolYears();
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());

  // ✅ Tính toán tuần hiện tại (bắt đầu từ thứ 2)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Thứ 2 là ngày đầu tuần
    return new Date(d.setDate(diff));
  };

  // ✅ Tính toán giới hạn tuần: từ tuần trước tuần hiện tại đến 9 tuần sau
  const getMinWeek = (): Date => {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const minWeek = new Date(currentWeekStart);
    minWeek.setDate(minWeek.getDate() - 7); // Tuần trước tuần hiện tại
    return minWeek;
  };

  const getMaxWeek = (): Date => {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const maxWeek = new Date(currentWeekStart);
    maxWeek.setDate(maxWeek.getDate() + 9 * 7); // 9 tuần sau
    return maxWeek;
  };

  const minWeek = useMemo(() => getMinWeek(), []);
  const maxWeek = useMemo(() => getMaxWeek(), []);

  // ✅ Khởi tạo tuần hiện tại
  useEffect(() => {
    const weekStart = getWeekStart(new Date());
    setCurrentWeek(weekStart);
  }, []);

  // ✅ Lấy năm học hiện tại
  useEffect(() => {
    if (currentYear) {
      setSchoolYear(currentYear);
    } else if (allSchoolYears.length > 0) {
      setSchoolYear(allSchoolYears[allSchoolYears.length - 1].code || allSchoolYears[allSchoolYears.length - 1].name);
    }
  }, [currentYear, allSchoolYears]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configData = await getScheduleConfig();
        setConfig(configData);
      } catch (err) {
        console.error('Error fetching config:', err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const teacherId = typeof backendUser?.teacherId === 'object' && backendUser?.teacherId !== null
      ? (backendUser.teacherId as any)._id
      : backendUser?.teacherId;
    
    if (teacherId && schoolYear) {
      fetchSchedules(teacherId, schoolYear, semester);
    }
  }, [backendUser, schoolYear, semester]);

  const fetchSchedules = async (teacherId: string, year: string, sem: string) => {
    try {
      setLoading(true);
      const data = await scheduleApi.getScheduleByTeacher(teacherId, year, sem);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
      if (err.response?.status !== 404) {
        toast({
          title: 'Lỗi',
          description: 'Không thể tải lịch giảng dạy',
          variant: 'destructive',
        });
      }
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Lấy danh sách 7 ngày trong tuần
  const getWeekDays = (weekStart: Date): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = useMemo(() => getWeekDays(currentWeek), [currentWeek]);

  // ✅ Chuyển đổi tên ngày sang định dạng trong schedule
  const getDayName = (date: Date): string => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getDay()];
  };

  // ✅ Lấy lịch giảng dạy cho một ngày cụ thể
  const getScheduleForDay = (date: Date) => {
    const dayName = getDayName(date);
    const daySchedules: any[] = [];

    schedules.forEach(schedule => {
      schedule.timetable?.forEach((dayEntry: any) => {
        const entryDay = dayEntry.day?.toLowerCase() || '';
        const targetDay = dayName.toLowerCase();
        
        // So khớp ngày (có thể là "Monday", "monday", "Mon", v.v.)
        if (entryDay.includes(targetDay.slice(0, 3)) || targetDay.includes(entryDay.slice(0, 3))) {
          dayEntry.periods?.forEach((period: any) => {
            daySchedules.push({
              ...period,
              className: schedule.classId?.className || schedule.className,
              subject: period.subject || period.subjectName,
              teacher: period.teacher || backendUser?.name,
            });
          });
        }
      });
    });

    return daySchedules.sort((a, b) => (a.period || a.periodIndex || 0) - (b.period || b.periodIndex || 0));
  };

  // ✅ Chuyển tuần
  const goToPreviousWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() - 7);
    if (newWeek >= minWeek) {
      setCurrentWeek(newWeek);
    } else {
      toast({
        title: 'Thông báo',
        description: 'Bạn chỉ có thể xem từ tuần trước tuần hiện tại',
        variant: 'default',
      });
    }
  };

  const goToNextWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + 7);
    if (newWeek <= maxWeek) {
      setCurrentWeek(newWeek);
    } else {
      toast({
        title: 'Thông báo',
        description: 'Bạn chỉ có thể xem đến 9 tuần sau tuần hiện tại',
        variant: 'default',
      });
    }
  };

  const goToCurrentWeek = () => {
    const weekStart = getWeekStart(new Date());
    setCurrentWeek(weekStart);
  };

  // ✅ Format ngày
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDayName = (date: Date): string => {
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return dayNames[date.getDay()];
  };

  const morningPeriods = config?.days?.['Monday']?.morningPeriods || 5;
  const afternoonPeriods = config?.days?.['Monday']?.afternoonPeriods || 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lịch giảng dạy theo tuần</h1>
          <p className="text-muted-foreground mt-1">
            Giáo viên: {backendUser?.name || 'Chưa xác định'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={schoolYear} onValueChange={setSchoolYear}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Năm học" />
            </SelectTrigger>
            <SelectContent>
              {allSchoolYears
                .filter((year) => year.code && year.code.trim() !== "")
                .map((year) => (
                  <SelectItem key={year.code || year._id} value={year.code || year.name}>
                    {year.name} {year.isActive && "(Hiện tại)"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Học kỳ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Học kỳ 1</SelectItem>
              <SelectItem value="2">Học kỳ 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ✅ Điều hướng tuần */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousWeek}
              disabled={currentWeek <= minWeek}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Tuần trước
            </Button>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="font-semibold">
                  Tuần {formatDate(currentWeek)} - {formatDate(new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(currentWeek)} - {formatDate(new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000))}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                <Calendar className="h-4 w-4 mr-1" />
                Tuần hiện tại
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextWeek}
              disabled={currentWeek >= maxWeek}
            >
              Tuần sau
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Đang tải lịch giảng dạy...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const daySchedules = getScheduleForDay(day);
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <Card key={index} className={isToday ? 'border-primary border-2' : ''}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    {formatDayName(day)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{formatDate(day)}</p>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {daySchedules.length > 0 ? (
                    daySchedules.map((schedule, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg border bg-primary/5 hover:bg-primary/10 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="secondary" className="text-xs">
                            Tiết {schedule.period || schedule.periodIndex || idx + 1}
                          </Badge>
                          {schedule.time && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {schedule.time}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-sm">{schedule.subject || schedule.subjectName || 'Chưa có môn'}</p>
                        <p className="text-xs text-muted-foreground">{schedule.className || 'Chưa có lớp'}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <Calendar className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p>Không có lịch</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeacherWeeklySchedulePage;


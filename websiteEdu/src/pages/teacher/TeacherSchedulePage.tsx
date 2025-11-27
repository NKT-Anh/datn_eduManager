import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleApi } from '@/services/scheduleApi';
import { getScheduleConfig } from '@/services/scheduleConfigApi';
import { ViewSchedule } from '@/components/schedule/ViewSchedule';
import { Calendar, Users, Loader2, Lock, Unlock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ScheduleConfig } from '@/types/schedule';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const TeacherSchedulePage = () => {
  const { backendUser } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [publishState, setPublishState] = useState<'locked' | 'pending' | null>(null);

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

    // Tính năm học hiện tại
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    setSchoolYear(currentYear);
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
      const parsed = Array.isArray(data) ? data : [];
      setSchedules(parsed);
      setPublishState(parsed.length > 0 ? 'locked' : 'pending');
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
      setPublishState('pending');
    } finally {
      setLoading(false);
    }
  };

  const morningPeriods = config?.days?.['Monday']?.morningPeriods || 5;
  const afternoonPeriods = config?.days?.['Monday']?.afternoonPeriods || 5;

  // Gộp tất cả các schedule thành một bảng tổng hợp
  const mergeSchedules = () => {
    if (schedules.length === 0) return null;

    // Tạo bảng trống với tất cả các ngày
    const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mergedTimetable = DAY_LABELS.map(day => ({
      day,
      periods: [] as any[],
    }));

    // Duyệt qua tất cả các schedule và gộp lại
    schedules.forEach(schedule => {
      schedule.timetable?.forEach((dayEntry: any) => {
        const dayIndex = DAY_LABELS.findIndex(d => 
          d.toLowerCase().includes(dayEntry.day.toLowerCase().slice(0, 3))
        );
        if (dayIndex >= 0) {
          dayEntry.periods.forEach((period: any) => {
            // Kiểm tra xem đã có period này chưa
            const existing = mergedTimetable[dayIndex].periods.find(
              p => p.period === period.period || p.periodIndex === period.period
            );
            if (!existing) {
              const className = schedule.classId?.className || schedule.className;
              mergedTimetable[dayIndex].periods.push({
                ...period,
                period: period.period || period.periodIndex,
                className: className,
              });
            } else {
              // Nếu trùng tiết, gộp thông tin lớp
              if (!existing.classNames) {
                existing.classNames = [existing.className || schedule.classId?.className];
              }
              existing.classNames.push(schedule.classId?.className || schedule.className);
              existing.className = existing.classNames.join(', ');
            }
          });
        }
      });
    });

    // Sắp xếp periods theo số tiết
    mergedTimetable.forEach(day => {
      day.periods.sort((a, b) => (a.period || a.periodIndex || 0) - (b.period || b.periodIndex || 0));
    });

    return {
      _id: 'merged',
      year: schedules[0]?.year || schoolYear,
      semester: schedules[0]?.semester || semester,
      timetable: mergedTimetable,
    };
  };

  const mergedSchedule = mergeSchedules();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lịch giảng dạy</h1>
          <p className="text-muted-foreground mt-1">
            Giáo viên: {backendUser?.name || 'Chưa xác định'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={schoolYear} onValueChange={setSchoolYear}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Năm học" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 3 }, (_, i) => {
                const year = new Date().getFullYear();
                const offset = i - 1;
                const y = year + offset;
                return (
                  <SelectItem key={`${y}-${y + 1}`} value={`${y}-${y + 1}`}>
                    {y}-{y + 1}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Học kỳ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Học kỳ 1</SelectItem>
              <SelectItem value="2">Học kỳ 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!loading && publishState === 'locked' && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <Lock className="h-4 w-4" />
          <AlertTitle>Lịch giảng dạy đã được công bố</AlertTitle>
          <AlertDescription>
            Dữ liệu bên dưới chỉ bao gồm các thời khóa biểu đã được BGH khóa, đảm bảo học sinh và giáo viên nhìn thấy cùng một nội dung.
          </AlertDescription>
        </Alert>
      )}

      {!loading && publishState === 'pending' && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <Unlock className="h-4 w-4" />
          <AlertTitle>Chưa có lịch giảng dạy được công bố</AlertTitle>
          <AlertDescription>
            Khi các lớp bạn phụ trách được khóa thời khóa biểu, lịch giảng dạy sẽ tự động xuất hiện tại đây.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Đang tải lịch giảng dạy...</p>
          </CardContent>
        </Card>
      ) : mergedSchedule ? (
        <div className="space-y-4">
          <ViewSchedule
            schedule={mergedSchedule}
            loading={false}
            title="Lịch giảng dạy của tôi"
            showClass={false}
            morningPeriods={morningPeriods}
            afternoonPeriods={afternoonPeriods}
          />
          
          {schedules.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4" />
                  <h3 className="font-semibold">Các lớp giảng dạy ({schedules.length})</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {schedules.map((schedule) => (
                    <div key={schedule._id} className="p-3 border rounded-lg">
                      <p className="font-medium">
                        {schedule.classId?.className || schedule.className}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Khối {schedule.classId?.grade || schedule.classId?.grade}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Chưa có lịch giảng dạy</h3>
            <p className="text-muted-foreground">
              Bạn chưa có lịch giảng dạy cho học kỳ này.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherSchedulePage;


import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import attendanceApi from '@/services/attendanceApi';
import {
  ClipboardList,
  Calendar,
  Check,
  X,
  AlertCircle,
  Clock,
  TrendingUp,
  BookOpen,
  Loader2,
  CalendarDays,
  BarChart3,
} from 'lucide-react';

interface AttendanceRecord {
  _id: string;
  studentId: {
    _id: string;
    name: string;
    studentCode?: string;
  };
  classId: {
    _id: string;
    className: string;
    classCode: string;
    grade: string;
  };
  subjectId?: {
    _id: string;
    name: string;
    code?: string;
  };
  teacherId?: {
    _id: string;
    name: string;
  };
  date: string;
  period?: number; // Optional - backward compatible
  session?: 'morning' | 'afternoon'; // New session-based attendance
  status: 'present' | 'absent' | 'excused' | 'late';
  notes?: string;
  schoolYear: string;
  semester: string;
}

type ViewMode = 'day' | 'week' | 'month' | 'calendar' | 'semester' | 'year';

const StudentAttendancePage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [viewMode, setViewMode] = useState<ViewMode>('day');

  // Tính năm học hiện tại
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    setSchoolYear(currentYear);
  }, []);

  // Tính tuần hiện tại
  useEffect(() => {
    if (viewMode === 'week' && !selectedWeek) {
      const now = new Date();
      const weekStart = getWeekStart(now);
      setSelectedWeek(weekStart.toISOString().split('T')[0]);
    }
  }, [viewMode, selectedWeek]);

  // Lấy điểm danh theo view mode
  useEffect(() => {
    if (!schoolYear) return;

    if (viewMode === 'day' && selectedDate) {
      fetchDayAttendance();
    } else if (viewMode === 'week' && selectedWeek) {
      fetchWeekAttendance();
    } else if ((viewMode === 'month' || viewMode === 'calendar') && selectedMonth) {
      fetchMonthAttendance();
    } else if (viewMode === 'semester' || viewMode === 'year') {
      fetchSemesterAttendance();
    }
  }, [selectedDate, selectedWeek, selectedMonth, schoolYear, semester, viewMode]);

  const fetchDayAttendance = async () => {
    try {
      setLoading(true);
      const res = await attendanceApi.getAttendance({
        date: selectedDate,
        schoolYear,
        semester,
      });
      if (res.success && res.data) {
        setAttendances(res.data);
      } else {
        setAttendances([]);
      }
    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải điểm danh',
        variant: 'destructive',
      });
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeekAttendance = async () => {
    try {
      setLoading(true);
      const weekStart = new Date(selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const [res, statsRes] = await Promise.all([
        attendanceApi.getAttendance({
          schoolYear,
          semester,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
        }).catch(() => ({ success: false, data: [] })),
        attendanceApi.getAttendanceStats({
          schoolYear,
          semester,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
        }).catch(() => ({ success: false, data: null })),
      ]);

      if (res.success && res.data) {
        setAttendances(res.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching week attendance:', err);
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthAttendance = async () => {
    try {
      setLoading(true);
      const [startDate, endDate] = getMonthRange(selectedMonth);
      
      const [res, statsRes] = await Promise.all([
        attendanceApi.getAttendance({
          schoolYear,
          semester,
          startDate,
          endDate,
        }).catch(() => ({ success: false, data: [] })),
        attendanceApi.getAttendanceStats({
          schoolYear,
          semester,
          startDate,
          endDate,
        }).catch(() => ({ success: false, data: null })),
      ]);

      if (res.success && res.data) {
        setAttendances(res.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching month attendance:', err);
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSemesterAttendance = async () => {
    try {
      setLoading(true);
      const [startDate, endDate] = getSemesterRange(schoolYear, semester);
      
      const [res, statsRes] = await Promise.all([
        attendanceApi.getAttendance({
          schoolYear,
          semester,
          startDate,
          endDate,
        }).catch(() => ({ success: false, data: [] })),
        attendanceApi.getAttendanceStats({
          schoolYear,
          semester,
          startDate,
          endDate,
        }).catch(() => ({ success: false, data: null })),
      ]);

      if (res.success && res.data) {
        setAttendances(res.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching semester attendance:', err);
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    return new Date(d.setDate(diff));
  };

  const getMonthRange = (month: string): [string, string] => {
    const [year, monthNum] = month.split('-');
    const start = `${year}-${monthNum}-01`;
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const end = `${year}-${monthNum}-${lastDay}`;
    return [start, end];
  };

  const getSemesterRange = (year: string, sem: string): [string, string] => {
    const [startYear, endYear] = year.split('-');
    if (sem === '1') {
      return [`${startYear}-08-01`, `${startYear}-12-31`];
    } else {
      return [`${endYear}-01-01`, `${endYear}-05-31`];
    }
  };

  // Tính trạng thái điểm danh cho một ngày (dựa trên session morning/afternoon)
  const getDayStatus = (date: string): 'present' | 'absent' | 'excused' | 'late' | 'mixed' | null => {
    const dayRecords = attendances.filter(att => {
      const attDate = new Date(att.date).toISOString().split('T')[0];
      return attDate === date;
    });

    if (dayRecords.length === 0) return null;

    // Nếu có nhiều session, kiểm tra xem có mixed không
    const statuses = dayRecords.map(r => r.status);
    const uniqueStatuses = [...new Set(statuses)];
    
    if (uniqueStatuses.length === 1) {
      return uniqueStatuses[0] as any;
    }
    return 'mixed';
  };

  // Màu sắc và ký hiệu cho từng trạng thái
  const getStatusColor = (status: string | null): string => {
    switch (status) {
      case 'present':
        return 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/20 dark:border-green-500 dark:text-green-400';
      case 'absent':
        return 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/20 dark:border-red-500 dark:text-red-400';
      case 'excused':
        return 'bg-yellow-100 border-yellow-500 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-500 dark:text-yellow-400';
      case 'late':
        return 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400';
      case 'mixed':
        return 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/20 dark:border-purple-500 dark:text-purple-400';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string | null): JSX.Element | null => {
    switch (status) {
      case 'present':
        return <span className="text-lg">🟢</span>;
      case 'absent':
        return <span className="text-lg">🔴</span>;
      case 'excused':
        return <span className="text-lg">🟡</span>;
      case 'late':
        return <span className="text-lg">🔵</span>;
      case 'mixed':
        return <span className="text-lg">🟣</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present':
        return (
          <Badge className="bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Có mặt
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            Vắng không phép
          </Badge>
        );
      case 'excused':
        return (
          <Badge className="bg-yellow-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Vắng có phép
          </Badge>
        );
      case 'late':
        return (
          <Badge className="bg-blue-600">
            <Clock className="h-3 w-3 mr-1" />
            Đi trễ
          </Badge>
        );
      default:
        return null;
    }
  };

  // Nhóm điểm danh theo ngày
  const groupedByDate = useMemo(() => {
    return attendances.reduce((acc: any, att) => {
      const dateKey = new Date(att.date).toISOString().split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(att);
      return acc;
    }, {});
  }, [attendances]);

  // Tạo lịch tháng
  const calendarDays = useMemo(() => {
    if (viewMode !== 'calendar') return [];
    
    const [year, month] = selectedMonth.split('-');
    const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
    const lastDay = new Date(parseInt(year), parseInt(month), 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday = 0

    const days = [];
    
    // Thêm các ngày trống ở đầu tháng
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Thêm các ngày trong tháng
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      days.push(dateStr);
    }
    
    return days;
  }, [selectedMonth, viewMode]);

  // Tính thống kê
  const calculateStats = () => {
    if (!stats) return null;
    
    const totalSessions = stats.totalAbsent || 0;
    const present = stats.present || 0;
    const absent = stats.absent || 0;
    const excused = stats.excused || 0;
    const late = stats.late || 0;
    const total = present + absent + excused + late;
    const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : '0';
    
    return {
      total,
      present,
      absent,
      excused,
      late,
      attendanceRate,
    };
  };

  const displayStats = calculateStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lịch sử điểm danh</h1>
          <p className="text-muted-foreground">Xem lịch sử điểm danh của bạn</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={viewMode === 'day' ? 'default' : 'outline'}
                onClick={() => setViewMode('day')}
                size="sm"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Theo ngày
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'outline'}
                onClick={() => setViewMode('week')}
                size="sm"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Theo tuần
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                onClick={() => setViewMode('month')}
                size="sm"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Theo tháng
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'outline'}
                onClick={() => setViewMode('calendar')}
                size="sm"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Lịch tháng
              </Button>
              <Button
                variant={viewMode === 'semester' ? 'default' : 'outline'}
                onClick={() => setViewMode('semester')}
                size="sm"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Học kỳ
              </Button>
              <Button
                variant={viewMode === 'year' ? 'default' : 'outline'}
                onClick={() => setViewMode('year')}
                size="sm"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Năm học
              </Button>
            </div>
            <div className="flex flex-wrap gap-4">
              {viewMode === 'day' && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
              )}
              {viewMode === 'week' && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <Input
                    type="date"
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
              )}
              {(viewMode === 'month' || viewMode === 'calendar') && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
              )}
              <Select value={schoolYear} onValueChange={setSchoolYear}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {displayStats && (viewMode === 'week' || viewMode === 'month' || viewMode === 'calendar' || viewMode === 'semester' || viewMode === 'year') && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <ClipboardList className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{displayStats.total}</p>
              <p className="text-sm text-muted-foreground">Tổng số buổi</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Check className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{displayStats.present}</p>
              <p className="text-sm text-muted-foreground">Có mặt</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <X className="h-6 w-6 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{displayStats.absent}</p>
              <p className="text-sm text-muted-foreground">Vắng không phép</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertCircle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-600">{displayStats.excused}</p>
              <p className="text-sm text-muted-foreground">Vắng có phép</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">{displayStats.attendanceRate}%</p>
              <p className="text-sm text-muted-foreground">Tỷ lệ chuyên cần</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Content */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Đang tải điểm danh...</p>
          </CardContent>
        </Card>
      ) : viewMode === 'day' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Điểm danh ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendances.length > 0 ? (
              <div className="space-y-4">
                {attendances.map((att) => (
                  <div key={att._id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {att.session ? (
                            <Badge variant="outline">
                              {att.session === 'morning' ? 'Buổi sáng' : 'Buổi chiều'}
                            </Badge>
                          ) : att.subjectId ? (
                            <>
                              <BookOpen className="h-4 w-4 text-primary" />
                              <span className="font-semibold">{att.subjectId.name}</span>
                              {att.period && <Badge variant="outline">Tiết {att.period}</Badge>}
                            </>
                          ) : null}
                        </div>
                        {att.teacherId && (
                          <p className="text-sm text-muted-foreground">
                            Giáo viên: {att.teacherId.name}
                          </p>
                        )}
                        {att.notes && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Ghi chú: {att.notes}
                          </p>
                        )}
                      </div>
                      <div>{getStatusBadge(att.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Chưa có điểm danh</h3>
                <p className="text-muted-foreground">Chưa có dữ liệu điểm danh cho ngày này</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'calendar' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Lịch điểm danh tháng {new Date(selectedMonth + '-01').toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </CardTitle>
            <CardDescription>
              Mỗi ô đại diện cho một ngày. Màu sắc thể hiện trạng thái điểm danh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {/* Header */}
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                <div key={day} className="text-center font-semibold text-sm p-2">
                  {day}
                </div>
              ))}
              {/* Calendar days */}
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }
                const status = getDayStatus(date);
                const dayRecords = groupedByDate[date] || [];
                return (
                  <div
                    key={date}
                    className={`aspect-square border-2 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(status)}`}
                    title={date}
                  >
                    <div className="text-lg font-bold">{new Date(date).getDate()}</div>
                    {getStatusIcon(status)}
                    {dayRecords.length > 0 && (
                      <div className="text-xs mt-1">
                        {dayRecords.filter((r: AttendanceRecord) => r.status === 'absent').length > 0 && '🔴'}
                        {dayRecords.filter((r: AttendanceRecord) => r.status === 'excused').length > 0 && '🟡'}
                        {dayRecords.filter((r: AttendanceRecord) => r.status === 'late').length > 0 && '🔵'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 justify-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">🟢</span>
                <span className="text-sm">Có mặt</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🔴</span>
                <span className="text-sm">Vắng không phép</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🟡</span>
                <span className="text-sm">Vắng có phép</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🔵</span>
                <span className="text-sm">Đi trễ</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🟣</span>
                <span className="text-sm">Nhiều trạng thái</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByDate).map(([date, dayAttendances]: [string, any]) => (
            <Card key={date}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {new Date(date).toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dayAttendances.map((att: AttendanceRecord) => (
                    <div key={att._id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {att.session ? (
                              <Badge variant="outline">
                                {att.session === 'morning' ? 'Buổi sáng' : 'Buổi chiều'}
                              </Badge>
                            ) : att.subjectId ? (
                              <>
                                <BookOpen className="h-4 w-4 text-primary" />
                                <span className="font-medium">{att.subjectId.name}</span>
                                {att.period && <Badge variant="outline" className="text-xs">Tiết {att.period}</Badge>}
                              </>
                            ) : null}
                          </div>
                          {att.teacherId && (
                            <p className="text-xs text-muted-foreground">
                              {att.teacherId.name} {att.notes && ` - ${att.notes}`}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(att.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {attendances.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Chưa có điểm danh</h3>
                <p className="text-muted-foreground">Chưa có dữ liệu điểm danh cho khoảng thời gian này</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAttendancePage;

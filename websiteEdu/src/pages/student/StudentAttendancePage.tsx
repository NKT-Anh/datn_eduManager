import { useState, useEffect } from 'react';
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
  School,
  BookOpen,
  Loader2,
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
  subjectId: {
    _id: string;
    name: string;
    code?: string;
  };
  teacherId: {
    _id: string;
    name: string;
  };
  date: string;
  period: number;
  status: 'present' | 'absent' | 'excused' | 'late';
  notes?: string;
  schoolYear: string;
  semester: string;
}

const StudentAttendancePage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');

  // Tính năm học hiện tại
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    setSchoolYear(currentYear);
  }, []);

  // Lấy điểm danh theo ngày
  useEffect(() => {
    if (viewMode === 'day' && selectedDate && schoolYear) {
      fetchDayAttendance();
    }
  }, [selectedDate, schoolYear, semester, viewMode]);

  // Lấy thống kê theo tháng
  useEffect(() => {
    if (viewMode === 'month' && selectedMonth && schoolYear) {
      fetchMonthStats();
    }
  }, [selectedMonth, schoolYear, semester, viewMode]);

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
      }
    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải điểm danh',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthStats = async () => {
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
      console.error('Error fetching stats:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thống kê',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getMonthRange = (month: string): [string, string] => {
    const [year, monthNum] = month.split('-');
    const start = `${year}-${monthNum}-01`;
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const end = `${year}-${monthNum}-${lastDay}`;
    return [start, end];
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
          <Badge className="bg-orange-600">
            <Clock className="h-3 w-3 mr-1" />
            Muộn
          </Badge>
        );
      default:
        return null;
    }
  };

  // Nhóm điểm danh theo ngày
  const groupedByDate = attendances.reduce((acc: any, att) => {
    const dateKey = new Date(att.date).toISOString().split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(att);
    return acc;
  }, {});

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
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'day' ? 'default' : 'outline'}
                onClick={() => setViewMode('day')}
              >
                Theo ngày
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                onClick={() => setViewMode('month')}
              >
                Theo tháng
              </Button>
            </div>
            {viewMode === 'day' ? (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
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
        </CardContent>
      </Card>

      {/* Stats (month view) */}
      {viewMode === 'month' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <ClipboardList className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Tổng số tiết</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Check className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              <p className="text-sm text-muted-foreground">Có mặt</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <X className="h-6 w-6 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              <p className="text-sm text-muted-foreground">Vắng không phép</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertCircle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-600">{stats.excused}</p>
              <p className="text-sm text-muted-foreground">Vắng có phép</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">{stats.attendanceRate}%</p>
              <p className="text-sm text-muted-foreground">Tỷ lệ có mặt</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance List */}
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
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{att.subjectId.name}</span>
                          <Badge variant="outline">Tiết {att.period}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Giáo viên: {att.teacherId.name}
                        </p>
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
                            <BookOpen className="h-4 w-4 text-primary" />
                            <span className="font-medium">{att.subjectId.name}</span>
                            <Badge variant="outline" className="text-xs">Tiết {att.period}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {att.teacherId.name} {att.notes && ` - ${att.notes}`}
                          </p>
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
                <p className="text-muted-foreground">Chưa có dữ liệu điểm danh cho tháng này</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAttendancePage;


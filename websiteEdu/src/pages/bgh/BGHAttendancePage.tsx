import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import attendanceApi from '@/services/attendanceApi';
import { useClasses, useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import {
  ClipboardList,
  Check,
  X,
  AlertCircle,
  Clock,
  TrendingUp,
  Loader2,
  Users,
  School,
  Calendar as CalendarIcon,
  Bell,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TodayStats {
  present: number;
  absent: number;
  excused: number;
  late: number;
  totalAbsent: number;
  attendanceRate: number;
  topLowAttendanceClass: {
    classId: string;
    className: string;
    grade: string;
    attendanceRate: number;
    totalAbsent: number;
  } | null;
}

interface Alert {
  lowAttendanceClasses: Array<{
    classId: string;
    className: string;
    grade: string;
    attendanceRate: number;
    totalAbsent: number;
    present: number;
  }>;
  studentsAbsentConsecutive: Array<{
    student: {
      _id: string;
      name: string;
      studentCode?: string;
    };
    class: {
      _id: string;
      className: string;
    };
    consecutiveDays: number;
    dates: string[];
  }>;
  teachersNotSubmitted: any[];
}

const BGHAttendancePage = () => {
  const { toast } = useToast();
  const { classes } = useClasses();
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { currentYearCode } = useCurrentAcademicYear();
  const schoolYears = useMemo(() => 
    allSchoolYears.map(y => ({ code: y.code, name: y.name })),
    [allSchoolYears]
  );

  // State
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [alerts, setAlerts] = useState<Alert | null>(null);
  const [statsByGrade, setStatsByGrade] = useState<any[]>([]);
  const [trends7Days, setTrends7Days] = useState<any[]>([]);
  const [classAttendance, setClassAttendance] = useState<any[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDateStats, setSelectedDateStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [dateStatsLoading, setDateStatsLoading] = useState(false);

  // Initialize school year
  useEffect(() => {
    if (currentYearCode) {
      setSchoolYear(currentYearCode);
    } else if (schoolYears.length > 0) {
      setSchoolYear(schoolYears[schoolYears.length - 1].code);
    }
  }, [schoolYears, currentYearCode]);

  // Fetch today stats
  const fetchTodayStats = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setStatsLoading(true);
      const res = await attendanceApi.getTodayAttendanceStats({ schoolYear, semester });
      if (res.success && res.data) {
        setTodayStats(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching today stats:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thống kê hôm nay',
        variant: 'destructive',
      });
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch alerts
  const fetchAlerts = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setStatsLoading(true);
      const res = await attendanceApi.getAttendanceAlerts({ schoolYear, semester });
      if (res.success && res.data) {
        setAlerts(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching alerts:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch stats by grade
  const fetchStatsByGrade = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setStatsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const res = await attendanceApi.getAttendanceStatsByGrade({ 
        schoolYear, 
        semester,
        startDate: today,
        endDate: today,
      });
      if (res.success && res.data) {
        setStatsByGrade(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching stats by grade:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch 7 days trends
  const fetchTrends7Days = async () => {
    if (!schoolYear || !semester) return;
    
    try {
      setStatsLoading(true);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6); // 7 ngày gần nhất

      const res = await attendanceApi.getAttendanceTrends({
        schoolYear,
        semester,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        groupBy: 'day',
      });
      if (res.success && res.data) {
        setTrends7Days(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching trends:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch class attendance
  const fetchClassAttendance = async () => {
    if (!selectedClassId || !schoolYear || !semester) return;
    
    try {
      setLoading(true);
      const res = await attendanceApi.getTodayAttendanceByClass(selectedClassId, { 
        schoolYear, 
        semester 
      });
      if (res.success && res.data) {
        setClassAttendance(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching class attendance:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải điểm danh lớp',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data
  useEffect(() => {
    if (schoolYear && semester) {
      fetchTodayStats();
      fetchAlerts();
      fetchStatsByGrade();
      fetchTrends7Days();
    }
  }, [schoolYear, semester]);

  // Load class attendance when class selected
  useEffect(() => {
    if (selectedClassId) {
      fetchClassAttendance();
    }
  }, [selectedClassId, schoolYear, semester]);

  const getStatusBadge = (status: string) => {
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
          <Badge className="bg-blue-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Vắng có phép
          </Badge>
        );
      case 'late':
        return (
          <Badge className="bg-orange-600">
            <Clock className="h-3 w-3 mr-1" />
            Đi trễ
          </Badge>
        );
      default:
        return null;
    }
  };

  // Prepare pie chart data
  const pieChartData = todayStats ? [
    { name: 'Có mặt', value: todayStats.present, color: '#22c55e' },
    { name: 'Vắng không phép', value: todayStats.absent, color: '#ef4444' },
    { name: 'Vắng có phép', value: todayStats.excused, color: '#3b82f6' },
    { name: 'Đi trễ', value: todayStats.late, color: '#f97316' },
  ].filter(item => item.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Chuyên Cần</h1>
          <p className="text-muted-foreground">
            Tổng quan điểm danh toàn trường - Ban Giám Hiệu
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <Label>Năm học</Label>
            <Select value={schoolYear} onValueChange={setSchoolYear}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Chọn năm học" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((y) => (
                  <SelectItem key={y.code} value={y.code}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Học kỳ</Label>
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
      </div>

      {/* Khu vực 1: Thống kê nhanh - Cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Đang tải thống kê...</span>
        </div>
      ) : todayStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 mb-1">🟢 Có mặt</p>
                  <p className="text-3xl font-bold text-green-700">{todayStats.present.toLocaleString()}</p>
                  <p className="text-xs text-green-600 mt-1">học sinh</p>
                </div>
                <Check className="h-12 w-12 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700 mb-1">🔴 Vắng KP</p>
                  <p className="text-3xl font-bold text-red-700">{todayStats.absent.toLocaleString()}</p>
                  <p className="text-xs text-red-600 mt-1">học sinh</p>
                </div>
                <X className="h-12 w-12 text-red-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-1">🔵 Vắng CP</p>
                  <p className="text-3xl font-bold text-blue-700">{todayStats.excused.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-1">học sinh</p>
                </div>
                <AlertCircle className="h-12 w-12 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 mb-1">📈 Chuyên cần</p>
                  <p className="text-3xl font-bold text-purple-700">{todayStats.attendanceRate}%</p>
                  <p className="text-xs text-purple-600 mt-1">tỷ lệ có mặt</p>
                </div>
                <TrendingUp className="h-12 w-12 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700 mb-1">⚠️ Lớp vắng cao</p>
                  <p className="text-2xl font-bold text-orange-700">
                    {todayStats.topLowAttendanceClass?.className || '-'}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {todayStats.topLowAttendanceClass 
                      ? `${todayStats.topLowAttendanceClass.attendanceRate}% - ${todayStats.topLowAttendanceClass.totalAbsent} HS vắng`
                      : 'Không có'}
                  </p>
                </div>
                <AlertCircle className="h-12 w-12 text-orange-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Khu vực 2: Biểu đồ tổng quan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart - Tỷ lệ chuyên cần theo khối */}
        <Card>
          <CardHeader>
            <CardTitle>Tỷ lệ chuyên cần theo khối</CardTitle>
            <CardDescription>Hôm nay - Toàn trường</CardDescription>
          </CardHeader>
          <CardContent>
            {statsByGrade.length > 0 ? (
              <ChartContainer
                config={{
                  attendanceRate: {
                    label: 'Tỷ lệ có mặt (%)',
                    color: 'hsl(var(--chart-1))',
                  },
                }}
                className="h-[300px]"
              >
                <BarChart data={statsByGrade.map(g => ({
                  grade: `Khối ${g.grade}`,
                  attendanceRate: g.attendanceRate,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis domain={[0, 100]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="attendanceRate" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Chưa có dữ liệu
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Tỷ lệ trạng thái hôm nay */}
        <Card>
          <CardHeader>
            <CardTitle>Tỷ lệ trạng thái hôm nay</CardTitle>
            <CardDescription>Phân bổ các trạng thái điểm danh</CardDescription>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <ChartContainer
                config={{
                  present: { label: 'Có mặt', color: '#22c55e' },
                  absent: { label: 'Vắng không phép', color: '#ef4444' },
                  excused: { label: 'Vắng có phép', color: '#3b82f6' },
                  late: { label: 'Đi trễ', color: '#f97316' },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer>
                  <RechartsPieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Chưa có dữ liệu
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Chart - 7 ngày gần nhất */}
      <Card>
        <CardHeader>
          <CardTitle>Xu hướng điểm danh 7 ngày gần nhất</CardTitle>
          <CardDescription>Theo dõi số lượng có mặt, vắng không phép, vắng có phép</CardDescription>
        </CardHeader>
        <CardContent>
          {trends7Days.length > 0 ? (
            <ChartContainer
              config={{
                present: { label: 'Có mặt', color: '#22c55e' },
                absent: { label: 'Vắng không phép', color: '#ef4444' },
                excused: { label: 'Vắng có phép', color: '#3b82f6' },
              }}
              className="h-[400px]"
            >
              <LineChart data={trends7Days.map(t => ({
                date: new Date(t.dateObj || t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
                present: t.present || 0,
                absent: t.absent || 0,
                excused: t.excused || 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="present" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  name="Có mặt"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="absent" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Vắng không phép"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="excused" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Vắng có phép"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              Chưa có dữ liệu
            </div>
          )}
        </CardContent>
      </Card>

      {/* Khu vực 3: Cảnh báo */}
      {alerts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top 5 lớp có tỷ lệ vắng cao */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-600" />
                Top 5 lớp có tỷ lệ vắng cao
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.lowAttendanceClasses.length > 0 ? (
                <div className="space-y-3">
                  {alerts.lowAttendanceClasses.map((cls, index) => (
                    <div key={cls.classId} className="p-3 border rounded-lg bg-orange-50 border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-orange-900">
                            ⚠️ {cls.className} - Khối {cls.grade}
                          </p>
                          <p className="text-sm text-orange-700 mt-1">
                            Tỷ lệ chuyên cần chỉ {cls.attendanceRate}% (vắng {cls.totalAbsent} HS)
                          </p>
                        </div>
                        <Badge variant="destructive">{cls.attendanceRate}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Không có lớp nào có tỷ lệ vắng cao
                </div>
              )}
            </CardContent>
          </Card>

          {/* Học sinh vắng nhiều ngày liên tiếp */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Học sinh vắng nhiều ngày liên tiếp
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.studentsAbsentConsecutive.length > 0 ? (
                <div className="space-y-3">
                  {alerts.studentsAbsentConsecutive.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-red-50 border-red-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-red-900">
                            ⚠️ HS: {item.student.name}
                            {item.student.studentCode && ` (${item.student.studentCode})`}
                          </p>
                          <p className="text-sm text-red-700 mt-1">
                            Lớp {item.class.className} - Vắng KP {item.consecutiveDays} ngày liên tiếp
                          </p>
                        </div>
                        <Badge variant="destructive">{item.consecutiveDays} ngày</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Không có học sinh nào vắng nhiều ngày liên tiếp
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Khu vực 4: Xem theo lớp */}
      <Card>
        <CardHeader>
          <CardTitle>Xem điểm danh theo lớp</CardTitle>
          <CardDescription>Chọn khối và lớp để xem điểm danh hôm nay</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>Khối</Label>
              <Select value={selectedGrade || 'all'} onValueChange={(v) => {
                setSelectedGrade(v === 'all' ? '' : v);
                setSelectedClassId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn khối" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả khối</SelectItem>
                  <SelectItem value="10">Khối 10</SelectItem>
                  <SelectItem value="11">Khối 11</SelectItem>
                  <SelectItem value="12">Khối 12</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lớp học</Label>
              <Select value={selectedClassId || 'all'} onValueChange={(v) => setSelectedClassId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn lớp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Chọn lớp</SelectItem>
                  {classes
                    .filter((c) => !selectedGrade || c.grade === selectedGrade)
                    .map((cls) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.className} - Khối {cls.grade}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchClassAttendance} disabled={!selectedClassId || loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang tải...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Xem điểm danh
                  </>
                )}
              </Button>
            </div>
          </div>

          {classAttendance.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Học sinh</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classAttendance.map((item) => (
                    <TableRow key={item.student._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={item.student.avatarUrl} alt={item.student.name} />
                            <AvatarFallback>
                              {item.student.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{item.student.name}</div>
                            {item.student.studentCode && (
                              <div className="text-sm text-muted-foreground">
                                {item.student.studentCode}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        {item.notes ? (
                          <span className="text-sm text-muted-foreground">{item.notes}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Khu vực 5: Lịch/Timeline điểm danh */}
      <Card>
        <CardHeader>
          <CardTitle>Lịch điểm danh</CardTitle>
          <CardDescription>Chọn ngày để xem thống kê điểm danh</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: vi }) : "Chọn ngày"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button 
              onClick={async () => {
                if (!schoolYear || !semester) {
                  toast({
                    title: 'Lỗi',
                    description: 'Vui lòng chọn năm học và học kỳ',
                    variant: 'destructive',
                  });
                  return;
                }
                try {
                  setDateStatsLoading(true);
                  const dateStr = format(selectedDate, 'yyyy-MM-dd');
                  const res = await attendanceApi.getAttendanceOverview({
                    schoolYear,
                    semester,
                    startDate: dateStr,
                    endDate: dateStr,
                  });
                  if (res.success && res.data && res.data.overall) {
                    setSelectedDateStats(res.data.overall);
                  }
                } catch (err: any) {
                  console.error('Error fetching date stats:', err);
                  toast({
                    title: 'Lỗi',
                    description: 'Không thể tải thống kê ngày được chọn',
                    variant: 'destructive',
                  });
                } finally {
                  setDateStatsLoading(false);
                }
              }}
              disabled={dateStatsLoading}
            >
              {dateStatsLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang tải...
                </>
              ) : (
                'Xem thống kê'
              )}
            </Button>
          </div>
          {selectedDateStats && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Có mặt</p>
                  <p className="text-2xl font-bold text-green-600">{selectedDateStats.present || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Vắng không phép</p>
                  <p className="text-2xl font-bold text-red-600">{selectedDateStats.absent || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Vắng có phép</p>
                  <p className="text-2xl font-bold text-blue-600">{selectedDateStats.excused || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Tỷ lệ chuyên cần</p>
                  <p className="text-2xl font-bold text-purple-600">{selectedDateStats.attendanceRate || 0}%</p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BGHAttendancePage;


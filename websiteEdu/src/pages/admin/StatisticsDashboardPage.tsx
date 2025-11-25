import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { useStudents } from '@/hooks/auth/useStudents';
import { useTeachers } from '@/hooks/teachers/useTeachers';
import { useClasses, useSchoolYears } from '@/hooks';
import gradesApi from '@/services/gradesApi';
import attendanceApi from '@/services/attendanceApi';
import { examApi } from '@/services/exams/examApi';
import { assignmentApi } from '@/services/assignmentApi';
import api from '@/services/axiosInstance';
import {
  BarChart3,
  TrendingUp,
  Users,
  GraduationCap,
  UserCheck,
  School,
  BookOpen,
  Clock,
  Award,
  AlertCircle,
  Loader2,
  Download,
  Calendar,
  ClipboardList,
  Presentation,
} from 'lucide-react';

const StatisticsDashboardPage = () => {
  const { toast } = useToast();
  const { students = [] } = useStudents();
  const { teachers = [] } = useTeachers();
  const { classes = [] } = useClasses();
  const { schoolYears: allSchoolYears, currentYearData } = useSchoolYears();
  const schoolYears = allSchoolYears.map(y => ({ code: y.code, name: y.name }));

  // State
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [loading, setLoading] = useState(false);
  
  // Statistics data
  const [userStats, setUserStats] = useState<any>(null);
  const [teachingStats, setTeachingStats] = useState<any>(null);
  const [gradesStats, setGradesStats] = useState<any>(null);
  const [conductStats, setConductStats] = useState<any>(null);
  const [attendanceStats, setAttendanceStats] = useState<any>(null);
  const [examStats, setExamStats] = useState<any>(null);

  // Initialize school year
  useEffect(() => {
    if (currentYearData?.code) {
      setSchoolYear(currentYearData.code);
    } else if (schoolYears.length > 0) {
      setSchoolYear(schoolYears[schoolYears.length - 1].code);
    }
  }, [schoolYears, currentYearData]);

  // Fetch all statistics
  const fetchAllStatistics = async () => {
    if (!schoolYear || !semester) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn năm học và học kỳ',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      // Fetch all stats in parallel
      const [
        gradesRes,
        attendanceRes,
        attendanceByGradeRes,
        examSummaryRes,
        examYearlyRes,
        conductRes,
        teachingRes,
        missingRes,
        classPeriodsRes,
      ] = await Promise.all([
        gradesApi.getStatistics({ schoolYear, semester }).catch(() => ({ success: false, data: null })),
        attendanceApi.getAttendanceOverview({ schoolYear, semester }).catch(() => ({ success: false, data: null })),
        attendanceApi.getAttendanceStatsByGrade({ schoolYear, semester }).catch(() => ({ success: false, data: [] })),
        examApi.getSummary().catch(() => []),
        examApi.getYearlyStats().catch(() => []),
        api.get('/conducts', { params: { year: schoolYear, semester } }).catch(() => ({ data: { data: [] } })),
        api.get('/teachingAssignments', { params: { year: schoolYear, semester } }).catch(() => ({ data: { data: [] } })),
        assignmentApi.checkMissingTeachers({ year: schoolYear, semester }).catch(() => null),
        api.get('/classPeriods', { params: { year: schoolYear, semester } }).catch(() => ({ data: { data: [] } })),
      ]);

      // Set statistics
      if (gradesRes.success && gradesRes.data) {
        setGradesStats(gradesRes.data);
      }

      if (attendanceRes.success && attendanceRes.data) {
        setAttendanceStats({
          ...attendanceRes.data,
          byGrade: attendanceByGradeRes.success && attendanceByGradeRes.data 
            ? attendanceByGradeRes.data 
            : attendanceRes.data.byGrade || [],
        });
      }

      if (Array.isArray(examSummaryRes)) {
        setExamStats({
          summary: examSummaryRes,
          yearly: Array.isArray(examYearlyRes) ? examYearlyRes : [],
        });
      }

      if (conductRes.data?.data) {
        const conducts = conductRes.data.data;
        const conductDistribution = {
          Tốt: conducts.filter((c: any) => c.conduct === 'Tốt').length,
          Khá: conducts.filter((c: any) => c.conduct === 'Khá').length,
          'Trung bình': conducts.filter((c: any) => c.conduct === 'Trung bình').length,
          Yếu: conducts.filter((c: any) => c.conduct === 'Yếu').length,
        };
        setConductStats(conductDistribution);
      }

      if (teachingRes.data?.data || teachingRes.data) {
        const assignments = Array.isArray(teachingRes.data?.data) ? teachingRes.data.data : (Array.isArray(teachingRes.data) ? teachingRes.data : []);
        const classPeriodsList = Array.isArray(classPeriodsRes.data?.data) ? classPeriodsRes.data.data : (Array.isArray(classPeriodsRes.data) ? classPeriodsRes.data : []);
        
        // Tạo map để tra cứu số tiết nhanh: classId-subjectId -> periods
        const periodsMap = new Map<string, number>();
        classPeriodsList.forEach((cp: any) => {
          const classId = cp.classId?._id?.toString() || cp.classId?.toString();
          if (!classId || !cp.subjectPeriods) return;
          
          // subjectPeriods có thể là Map hoặc Object
          const subjectPeriods = cp.subjectPeriods instanceof Map 
            ? Object.fromEntries(cp.subjectPeriods) 
            : cp.subjectPeriods;
          
          Object.entries(subjectPeriods).forEach(([subjectId, periods]: [string, any]) => {
            const key = `${classId}-${subjectId}`;
            periodsMap.set(key, Number(periods) || 0);
          });
        });
        
        // Helper function để lấy số tiết
        const getPeriods = (classId: string, subjectId: string): number => {
          const key = `${classId}-${subjectId}`;
          return periodsMap.get(key) || 2; // Default 2 tiết/tuần
        };
        
        const uniqueTeachers = new Set(assignments.map((a: any) => a.teacherId?._id || a.teacherId)).size;
        const uniqueClasses = new Set(assignments.map((a: any) => a.classId?._id || a.classId)).size;
        const uniqueSubjects = new Set(assignments.map((a: any) => a.subjectId?._id || a.subjectId)).size;
        
        // Tính số tiết dạy theo giáo viên
        const teacherPeriodsMap = new Map<string, { name: string; periods: number; classes: number; subjects: Set<string> }>();
        assignments.forEach((a: any) => {
          const teacherId = a.teacherId?._id?.toString() || a.teacherId?.toString();
          const teacherName = a.teacherId?.name || 'Không rõ';
          const classId = a.classId?._id?.toString() || a.classId?.toString();
          const subjectId = a.subjectId?._id?.toString() || a.subjectId?.toString();
          
          if (!teacherId || !classId || !subjectId) return;
          
          if (!teacherPeriodsMap.has(teacherId)) {
            teacherPeriodsMap.set(teacherId, { name: teacherName, periods: 0, classes: 0, subjects: new Set() });
          }
          const teacherStats = teacherPeriodsMap.get(teacherId)!;
          const periods = getPeriods(classId, subjectId);
          teacherStats.periods += periods;
          teacherStats.classes += 1;
          teacherStats.subjects.add(subjectId);
        });

        // Tính số tiết dạy theo môn học
        const subjectPeriodsMap = new Map<string, { name: string; periods: number; classes: number; teachers: Set<string> }>();
        assignments.forEach((a: any) => {
          const subjectId = a.subjectId?._id?.toString() || a.subjectId?.toString();
          const subjectName = a.subjectId?.name || 'Không rõ';
          const classId = a.classId?._id?.toString() || a.classId?.toString();
          const teacherId = a.teacherId?._id?.toString() || a.teacherId?.toString();
          
          if (!subjectId || !classId) return;
          
          if (!subjectPeriodsMap.has(subjectId)) {
            subjectPeriodsMap.set(subjectId, { name: subjectName, periods: 0, classes: 0, teachers: new Set() });
          }
          const subjectStats = subjectPeriodsMap.get(subjectId)!;
          const periods = getPeriods(classId, subjectId);
          subjectStats.periods += periods;
          subjectStats.classes += 1;
          if (teacherId) subjectStats.teachers.add(teacherId);
        });

        // Tính số tiết dạy theo lớp
        const classPeriodsMap = new Map<string, { name: string; periods: number; subjects: Set<string>; teachers: Set<string> }>();
        assignments.forEach((a: any) => {
          const classId = a.classId?._id?.toString() || a.classId?.toString();
          const className = a.classId?.className || 'Không rõ';
          const subjectId = a.subjectId?._id?.toString() || a.subjectId?.toString();
          const teacherId = a.teacherId?._id?.toString() || a.teacherId?.toString();
          
          if (!classId || !subjectId) return;
          
          if (!classPeriodsMap.has(classId)) {
            classPeriodsMap.set(classId, { name: className, periods: 0, subjects: new Set(), teachers: new Set() });
          }
          const classStats = classPeriodsMap.get(classId)!;
          const periods = getPeriods(classId, subjectId);
          classStats.periods += periods;
          classStats.subjects.add(subjectId);
          if (teacherId) classStats.teachers.add(teacherId);
        });

        setTeachingStats({
          totalAssignments: assignments.length,
          uniqueTeachers,
          uniqueClasses,
          uniqueSubjects,
          assignments: assignments.length,
          teacherPeriods: Array.from(teacherPeriodsMap.entries()).map(([id, stats]) => ({ 
            id, 
            name: stats.name, 
            periods: stats.periods, 
            classes: stats.classes, 
            subjects: stats.subjects.size 
          })),
          subjectPeriods: Array.from(subjectPeriodsMap.entries()).map(([id, stats]) => ({ 
            id, 
            name: stats.name, 
            periods: stats.periods, 
            classes: stats.classes, 
            teachers: stats.teachers.size 
          })),
          classPeriods: Array.from(classPeriodsMap.entries()).map(([id, stats]) => ({ 
            id, 
            name: stats.name, 
            periods: stats.periods, 
            subjects: stats.subjects.size, 
            teachers: stats.teachers.size 
          })),
          missingStats: missingRes || null,
        });
      }

      // User stats (from hooks)
      setUserStats({
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalClasses: classes.length,
        activeStudents: students.filter((s: any) => s.status === 'active').length,
        activeTeachers: teachers.filter((t: any) => t.status === 'active').length,
      });

    } catch (err: any) {
      console.error('Error fetching statistics:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thống kê',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schoolYear && semester) {
      fetchAllStatistics();
    }
  }, [schoolYear, semester, students.length, teachers.length, classes.length]);

  // Prepare chart data
  const userChartData = userStats ? [
    { name: 'Học sinh', value: userStats.totalStudents, color: '#3b82f6' },
    { name: 'Giáo viên', value: userStats.totalTeachers, color: '#10b981' },
    { name: 'Lớp học', value: userStats.totalClasses, color: '#f59e0b' },
  ] : [];

  const gradesChartData = gradesStats?.overall ? [
    { name: 'Giỏi', value: gradesStats.overall.excellent, color: '#22c55e' },
    { name: 'Khá', value: gradesStats.overall.good, color: '#3b82f6' },
    { name: 'Trung bình', value: gradesStats.overall.average, color: '#f59e0b' },
    { name: 'Yếu', value: gradesStats.overall.weak, color: '#ef4444' },
  ].filter(item => item.value > 0) : [];

  const conductChartData = conductStats ? [
    { name: 'Tốt', value: conductStats.Tốt || 0, color: '#22c55e' },
    { name: 'Khá', value: conductStats.Khá || 0, color: '#3b82f6' },
    { name: 'Trung bình', value: conductStats['Trung bình'] || 0, color: '#f59e0b' },
    { name: 'Yếu', value: conductStats.Yếu || 0, color: '#ef4444' },
  ].filter(item => item.value > 0) : [];

  const examChartData = examStats?.summary ? examStats.summary.map((item: any) => {
    const statusId = item._id;
    let name = '';
    let color = '#6b7280'; // Default gray
    
    if (statusId === 'draft') {
      name = 'Khởi tạo';
      color = '#3b82f6'; // Blue
    } else if (statusId === 'published') {
      name = 'Đã công bố';
      color = '#10b981'; // Green
    } else if (statusId === 'locked') {
      name = 'Đã khóa';
      color = '#f59e0b'; // Orange
    } else if (statusId === 'archived') {
      name = 'Kết thúc';
      color = '#6b7280'; // Gray
    } else {
      name = statusId;
    }
    
    return {
      name,
      value: item.count || 0,
      color,
      statusId,
    };
  }) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Dashboard Thống kê Tổng hợp
          </h1>
          <p className="text-muted-foreground">
            Tổng quan toàn bộ thống kê của hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchAllStatistics} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang tải...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Tải lại
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Năm học</Label>
              <Select value={schoolYear} onValueChange={setSchoolYear}>
                <SelectTrigger>
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
                <SelectTrigger>
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

      {/* Tabs for different statistics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="users">HS - GV</TabsTrigger>
          <TabsTrigger value="teaching">Phân công giảng dạy</TabsTrigger>
          <TabsTrigger value="grades">Học lực</TabsTrigger>
          <TabsTrigger value="conduct">Hạnh kiểm</TabsTrigger>
          <TabsTrigger value="attendance">Chuyên cần</TabsTrigger>
          <TabsTrigger value="exams">Điểm thi</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tổng học sinh</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{userStats?.totalStudents || 0}</div>
                  <Users className="h-8 w-8 text-blue-600 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {userStats?.activeStudents || 0} đang hoạt động
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tổng giáo viên</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{userStats?.totalTeachers || 0}</div>
                  <GraduationCap className="h-8 w-8 text-green-600 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {userStats?.activeTeachers || 0} đang hoạt động
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tổng lớp học</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{userStats?.totalClasses || 0}</div>
                  <School className="h-8 w-8 text-purple-600 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Trung bình {userStats?.totalClasses > 0 ? Math.round((userStats?.totalStudents || 0) / userStats.totalClasses) : 0} HS/lớp
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Phân công giảng dạy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{teachingStats?.totalAssignments || 0}</div>
                  <Presentation className="h-8 w-8 text-orange-600 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {teachingStats?.uniqueTeachers || 0} GV, {teachingStats?.uniqueClasses || 0} lớp
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Phân bổ người dùng</CardTitle>
              </CardHeader>
              <CardContent>
                {userChartData.length > 0 ? (
                  <ChartContainer
                    config={{
                      students: { label: 'Học sinh', color: '#3b82f6' },
                      teachers: { label: 'Giáo viên', color: '#10b981' },
                      classes: { label: 'Lớp học', color: '#f59e0b' },
                    }}
                    className="h-[250px]"
                  >
                    <ResponsiveContainer>
                      <RechartsPieChart>
                        <Pie
                          data={userChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {userChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Phân bổ học lực</CardTitle>
              </CardHeader>
              <CardContent>
                {gradesChartData.length > 0 ? (
                  <ChartContainer
                    config={{
                      excellent: { label: 'Giỏi', color: '#22c55e' },
                      good: { label: 'Khá', color: '#3b82f6' },
                      average: { label: 'Trung bình', color: '#f59e0b' },
                      weak: { label: 'Yếu', color: '#ef4444' },
                    }}
                    className="h-[250px]"
                  >
                    <ResponsiveContainer>
                      <RechartsPieChart>
                        <Pie
                          data={gradesChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {gradesChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Statistics Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Thống kê Học sinh - Giáo viên
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : userStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-4">Học sinh</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Tổng số học sinh:</span>
                        <Badge variant="outline">{userStats.totalStudents}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Đang hoạt động:</span>
                        <Badge className="bg-green-600">{userStats.activeStudents}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Đã nghỉ học:</span>
                        <Badge variant="destructive">
                          {userStats.totalStudents - userStats.activeStudents}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-4">Giáo viên</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Tổng số giáo viên:</span>
                        <Badge variant="outline">{userStats.totalTeachers}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Đang hoạt động:</span>
                        <Badge className="bg-green-600">{userStats.activeTeachers}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Đã nghỉ việc:</span>
                        <Badge variant="destructive">
                          {userStats.totalTeachers - userStats.activeTeachers}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teaching Statistics Tab */}
        <TabsContent value="teaching" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tổng phân công</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{teachingStats?.totalAssignments || 0}</div>
                  <Presentation className="h-8 w-8 text-blue-600 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Môn/lớp được phân công
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Giáo viên</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{teachingStats?.uniqueTeachers || 0}</div>
                  <GraduationCap className="h-8 w-8 text-green-600 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  GV có phân công
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lớp học</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{teachingStats?.uniqueClasses || 0}</div>
                  <School className="h-8 w-8 text-purple-600 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lớp có phân công
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Môn học</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{teachingStats?.uniqueSubjects || 0}</div>
                  <BookOpen className="h-8 w-8 text-orange-600 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Môn được phân công
                </p>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : teachingStats ? (
            <div className="space-y-4">
              {/* Missing Teachers Alert */}
              {teachingStats.missingStats && teachingStats.missingStats.summary.totalMissing > 0 && (
                <Card className="bg-red-50 border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      Cảnh báo: Thiếu giáo viên
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Tổng lớp thiếu giáo viên:</span>
                        <Badge variant="destructive">{teachingStats.missingStats.summary.totalMissing}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Tổng số tiết thiếu:</span>
                        <Badge variant="destructive">
                          {teachingStats.missingStats.summary.bySubject.reduce((sum: number, subj: any) => 
                            sum + (subj.totalRequiredPeriods - subj.totalAssignedPeriods), 0
                          )}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Teachers by Periods */}
                {teachingStats.teacherPeriods && teachingStats.teacherPeriods.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 10 Giáo viên (Số tiết/tuần)</CardTitle>
                      <CardDescription>Sắp xếp theo số tiết dạy</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          periods: { label: 'Số tiết/tuần', color: '#3b82f6' },
                        }}
                        className="h-[300px]"
                      >
                        <BarChart
                          data={teachingStats.teacherPeriods
                            .sort((a, b) => b.periods - a.periods)
                            .slice(0, 10)
                            .map(t => ({ name: t.name.length > 15 ? t.name.substring(0, 15) + '...' : t.name, periods: t.periods }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="periods" fill="#3b82f6" name="Số tiết/tuần" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Top Subjects by Periods */}
                {teachingStats.subjectPeriods && teachingStats.subjectPeriods.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 10 Môn học (Số tiết/tuần)</CardTitle>
                      <CardDescription>Sắp xếp theo số tiết dạy</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          periods: { label: 'Số tiết/tuần', color: '#10b981' },
                        }}
                        className="h-[300px]"
                      >
                        <BarChart
                          data={teachingStats.subjectPeriods
                            .sort((a, b) => b.periods - a.periods)
                            .slice(0, 10)
                            .map(s => ({ name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name, periods: s.periods }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="periods" fill="#10b981" name="Số tiết/tuần" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Statistics Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Teachers Table */}
                {teachingStats.teacherPeriods && teachingStats.teacherPeriods.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        Thống kê theo Giáo viên
                      </CardTitle>
                      <CardDescription>
                        Tổng: {teachingStats.teacherPeriods.length} giáo viên
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>STT</TableHead>
                              <TableHead>Giáo viên</TableHead>
                              <TableHead className="text-center">Số tiết/tuần</TableHead>
                              <TableHead className="text-center">Số lớp</TableHead>
                              <TableHead className="text-center">Số môn</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {teachingStats.teacherPeriods
                              .sort((a, b) => b.periods - a.periods)
                              .map((teacher, index) => (
                                <TableRow key={teacher.id}>
                                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                  <TableCell className="font-medium">{teacher.name}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline">{teacher.periods}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className="bg-blue-600">{teacher.classes}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className="bg-green-600">{teacher.subjects}</Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Subjects Table */}
                {teachingStats.subjectPeriods && teachingStats.subjectPeriods.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Thống kê theo Môn học
                      </CardTitle>
                      <CardDescription>
                        Tổng: {teachingStats.subjectPeriods.length} môn học
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>STT</TableHead>
                              <TableHead>Môn học</TableHead>
                              <TableHead className="text-center">Số tiết/tuần</TableHead>
                              <TableHead className="text-center">Số lớp</TableHead>
                              <TableHead className="text-center">Số GV</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {teachingStats.subjectPeriods
                              .sort((a, b) => b.periods - a.periods)
                              .map((subject, index) => (
                                <TableRow key={subject.id}>
                                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                  <TableCell className="font-medium">{subject.name}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline">{subject.periods}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className="bg-blue-600">{subject.classes}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className="bg-green-600">{subject.teachers}</Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Classes Table */}
              {teachingStats.classPeriods && teachingStats.classPeriods.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <School className="h-5 w-5" />
                      Thống kê theo Lớp học
                    </CardTitle>
                    <CardDescription>
                      Tổng: {teachingStats.classPeriods.length} lớp học
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>STT</TableHead>
                            <TableHead>Lớp học</TableHead>
                            <TableHead className="text-center">Số tiết/tuần</TableHead>
                            <TableHead className="text-center">Số môn</TableHead>
                            <TableHead className="text-center">Số GV</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teachingStats.classPeriods
                            .sort((a, b) => b.periods - a.periods)
                            .map((classItem, index) => (
                              <TableRow key={classItem.id}>
                                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                <TableCell className="font-medium">{classItem.name}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline">{classItem.periods}</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-blue-600">{classItem.subjects}</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-green-600">{classItem.teachers}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Missing Assignments Table */}
              {teachingStats.missingStats && teachingStats.missingStats.missingAssignments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      Danh sách Lớp/Môn thiếu giáo viên
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lớp</TableHead>
                            <TableHead>Môn học</TableHead>
                            <TableHead className="text-center">Số tiết cần</TableHead>
                            <TableHead className="text-center">Số tiết đã phân</TableHead>
                            <TableHead className="text-center">Trạng thái</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teachingStats.missingStats.missingAssignments.slice(0, 20).map((item: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{item.className}</TableCell>
                              <TableCell>{item.subjectName || 'N/A'}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{item.requiredPeriods}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-green-600">{item.assignedPeriods}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="destructive">Thiếu</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Presentation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Chưa có dữ liệu phân công giảng dạy</p>
                  <p className="text-sm mt-2">Vui lòng chọn năm học và học kỳ để xem thống kê</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Grades Statistics Tab */}
        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Thống kê Học lực
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : gradesStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-green-700 mb-1">Giỏi</div>
                        <div className="text-3xl font-bold text-green-700">
                          {gradesStats.overall.excellent}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {gradesStats.overall.total > 0 
                            ? ((gradesStats.overall.excellent / gradesStats.overall.total) * 100).toFixed(1)
                            : 0}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-blue-700 mb-1">Khá</div>
                        <div className="text-3xl font-bold text-blue-700">
                          {gradesStats.overall.good}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {gradesStats.overall.total > 0 
                            ? ((gradesStats.overall.good / gradesStats.overall.total) * 100).toFixed(1)
                            : 0}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-orange-700 mb-1">Trung bình</div>
                        <div className="text-3xl font-bold text-orange-700">
                          {gradesStats.overall.average}
                        </div>
                        <div className="text-xs text-orange-600 mt-1">
                          {gradesStats.overall.total > 0 
                            ? ((gradesStats.overall.average / gradesStats.overall.total) * 100).toFixed(1)
                            : 0}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-red-700 mb-1">Yếu</div>
                        <div className="text-3xl font-bold text-red-700">
                          {gradesStats.overall.weak}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          {gradesStats.overall.total > 0 
                            ? ((gradesStats.overall.weak / gradesStats.overall.total) * 100).toFixed(1)
                            : 0}%
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Chart */}
                  {gradesChartData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Biểu đồ phân bổ học lực</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer
                          config={{
                            excellent: { label: 'Giỏi', color: '#22c55e' },
                            good: { label: 'Khá', color: '#3b82f6' },
                            average: { label: 'Trung bình', color: '#f59e0b' },
                            weak: { label: 'Yếu', color: '#ef4444' },
                          }}
                          className="h-[300px]"
                        >
                          <ResponsiveContainer>
                            <RechartsPieChart>
                              <Pie
                                data={gradesChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {gradesChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Legend />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conduct Statistics Tab */}
        <TabsContent value="conduct" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Thống kê Hạnh kiểm
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : conductStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-green-700 mb-1">Tốt</div>
                        <div className="text-3xl font-bold text-green-700">
                          {conductStats.Tốt || 0}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-blue-700 mb-1">Khá</div>
                        <div className="text-3xl font-bold text-blue-700">
                          {conductStats.Khá || 0}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-orange-700 mb-1">Trung bình</div>
                        <div className="text-3xl font-bold text-orange-700">
                          {conductStats['Trung bình'] || 0}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-red-700 mb-1">Yếu</div>
                        <div className="text-3xl font-bold text-red-700">
                          {conductStats.Yếu || 0}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Chart */}
                  {conductChartData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Biểu đồ phân bổ hạnh kiểm</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer
                          config={{
                            Tốt: { label: 'Tốt', color: '#22c55e' },
                            Khá: { label: 'Khá', color: '#3b82f6' },
                            'Trung bình': { label: 'Trung bình', color: '#f59e0b' },
                            Yếu: { label: 'Yếu', color: '#ef4444' },
                          }}
                          className="h-[300px]"
                        >
                          <ResponsiveContainer>
                            <RechartsPieChart>
                              <Pie
                                data={conductChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {conductChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Legend />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Statistics Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Thống kê Chuyên cần
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : attendanceStats?.overall ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-green-700 mb-1">Có mặt</div>
                        <div className="text-3xl font-bold text-green-700">
                          {attendanceStats.overall.present || 0}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-red-700 mb-1">Vắng không phép</div>
                        <div className="text-3xl font-bold text-red-700">
                          {attendanceStats.overall.absent || 0}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-blue-700 mb-1">Vắng có phép</div>
                        <div className="text-3xl font-bold text-blue-700">
                          {attendanceStats.overall.excused || 0}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-purple-700 mb-1">Tỷ lệ chuyên cần</div>
                        <div className="text-3xl font-bold text-purple-700">
                          {attendanceStats.overall.attendanceRate || 0}%
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Chart by Grade */}
                  {attendanceStats.byGrade && attendanceStats.byGrade.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Thống kê theo khối</CardTitle>
                        <CardDescription>Tỷ lệ chuyên cần và số học sinh vắng mặt theo từng khối</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer
                          config={{
                            attendanceRate: { label: 'Tỷ lệ chuyên cần', color: '#3b82f6' },
                          }}
                          className="h-[300px]"
                        >
                          <BarChart data={attendanceStats.byGrade.map((g: any) => ({
                            grade: `Khối ${g.grade}`,
                            attendanceRate: g.attendanceRate || 0,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="grade" />
                            <YAxis domain={[0, 100]} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="attendanceRate" fill="#3b82f6" name="Tỷ lệ chuyên cần (%)" />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Table by Grade */}
                  {attendanceStats.byGrade && attendanceStats.byGrade.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <School className="h-5 w-5" />
                          Thống kê chi tiết theo khối
                        </CardTitle>
                        <CardDescription>
                          Chỉ hiển thị dữ liệu vắng mặt để tối ưu hiệu suất
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Khối</TableHead>
                                <TableHead className="text-center">Số lớp</TableHead>
                                <TableHead className="text-center">Tổng HS</TableHead>
                                <TableHead className="text-center">Có mặt</TableHead>
                                <TableHead className="text-center">Vắng không phép</TableHead>
                                <TableHead className="text-center">Vắng có phép</TableHead>
                                <TableHead className="text-center">Đi trễ</TableHead>
                                <TableHead className="text-center">Tỷ lệ (%)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {attendanceStats.byGrade
                                .sort((a: any, b: any) => a.grade.localeCompare(b.grade))
                                .map((grade: any) => (
                                  <TableRow key={grade.grade}>
                                    <TableCell className="font-medium">Khối {grade.grade}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant="outline">{grade.totalClasses || 0}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center font-medium">
                                      {grade.totalStudents || 0}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge className="bg-green-600">{grade.present || 0}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant="destructive">{grade.absent || 0}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge className="bg-blue-600">{grade.excused || 0}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge className="bg-orange-600">{grade.late || 0}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge 
                                        variant={grade.attendanceRate >= 95 ? "default" : grade.attendanceRate >= 90 ? "secondary" : "destructive"}
                                        className={
                                          grade.attendanceRate >= 95 ? "bg-green-600" : 
                                          grade.attendanceRate >= 90 ? "bg-yellow-600" : 
                                          "bg-red-600"
                                        }
                                      >
                                        {grade.attendanceRate?.toFixed(1) || 0}%
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exam Statistics Tab */}
        <TabsContent value="exams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Thống kê Điểm thi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : examStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {examStats.summary && examStats.summary.map((item: any) => (
                      <Card key={item._id}>
                        <CardContent className="p-4 text-center">
                          <div className="text-sm text-muted-foreground mb-1">
                            {item._id === 'draft' ? 'Khởi tạo' :
                             item._id === 'published' ? 'Đã công bố' :
                             item._id === 'locked' ? 'Đã khóa' :
                             item._id === 'archived' ? 'Kết thúc' : item._id}
                          </div>
                          <div className="text-3xl font-bold">
                            {item.count || 0}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {/* Chart */}
                  {examChartData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Phân bổ kỳ thi theo trạng thái</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer
                          config={{
                            draft: { label: 'Khởi tạo', color: '#3b82f6' },
                            published: { label: 'Đã công bố', color: '#10b981' },
                            locked: { label: 'Đã khóa', color: '#f59e0b' },
                            archived: { label: 'Kết thúc', color: '#6b7280' },
                          }}
                          className="h-[300px]"
                        >
                          <ResponsiveContainer>
                            <RechartsPieChart>
                              <Pie
                                data={examChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {examChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color || ['#3b82f6', '#10b981', '#f59e0b', '#6b7280'][index % 4]} />
                                ))}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Legend />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StatisticsDashboardPage;


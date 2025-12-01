import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import { useStudents } from '@/hooks/auth/useStudents';
import { scheduleApi } from '@/services/scheduleApi';
import gradesApi from '@/services/gradesApi';
import attendanceApi from '@/services/attendanceApi';
import conductApi from '@/services/conductApi';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock,
  BookOpen,
  TrendingUp,
  CheckCircle,
  Award,
  Users,
  Bell,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface ScheduleItem {
  _id: string;
  subjectId: {
    _id: string;
    name: string;
    subjectCode?: string;
  };
  period: number;
  room?: string;
  teacherId?: {
    _id: string;
    name: string;
  };
}

interface GradeItem {
  _id: string;
  subjectId: {
    _id: string;
    name: string;
  };
  average?: number;
  semester: string;
  schoolYear: string;
}

const StudentDashboard = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentYearCode } = useCurrentAcademicYear();
  const { students, isLoading: isLoadingStudents } = useStudents();
  
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [recentGrades, setRecentGrades] = useState<GradeItem[]>([]);
  const [averageGrade, setAverageGrade] = useState<number>(0);
  const [attendanceRate, setAttendanceRate] = useState<number>(0);
  const [subjectCount, setSubjectCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Tính năm học hiện tại
  const currentYear = currentYearCode || (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  })();

  const semester = '1'; // Học kỳ hiện tại

  // Lấy thông tin học sinh
  useEffect(() => {
    if (!backendUser || isLoadingStudents) return;

    const student = students.find((s: any) =>
      s.accountId?._id === backendUser._id ||
      s.accountId?._id?.toString() === backendUser._id?.toString() ||
      s.accountId === backendUser._id
    );

    if (student) {
      setStudentInfo(student);
    }
  }, [backendUser, students, isLoadingStudents]);

  // Lấy lịch học hôm nay
  useEffect(() => {
    const fetchTodaySchedule = async () => {
      if (!studentInfo || !currentYear) return;

      try {
        const classId = typeof studentInfo.classId === 'object' 
          ? studentInfo.classId?._id 
          : studentInfo.classId;

        if (!classId) return;

        const schedule = await scheduleApi.getScheduleByClass(classId, currentYear, semester);
        
        if (schedule && schedule.schedules) {
          // Lấy thứ trong tuần (0 = Chủ nhật, 1 = Thứ 2, ...)
          const today = new Date().getDay();
          const dayOfWeek = today === 0 ? 7 : today; // Chuyển Chủ nhật thành 7

          // Lọc lịch theo thứ trong tuần
          const todayItems = schedule.schedules
            .filter((item: any) => item.dayOfWeek === dayOfWeek)
            .sort((a: any, b: any) => a.period - b.period);

          setTodaySchedule(todayItems);
        }
      } catch (error: any) {
        console.error('Error fetching schedule:', error);
      }
    };

    if (studentInfo && currentYear) {
      fetchTodaySchedule();
    }
  }, [studentInfo, currentYear, semester]);

  // Lấy điểm số gần đây
  useEffect(() => {
    const fetchGrades = async () => {
      if (!studentInfo || !currentYear) return;

      try {
        const studentId = studentInfo._id;
        const res = await gradesApi.getStudentGrades({
          studentId,
          schoolYear: currentYear,
          semester,
        });

        if (res.success && res.data) {
          const grades = res.data;
          
          // ✅ Chỉ lấy các môn có điểm số thực tế (average không null/undefined)
          const validGrades = grades.filter((g: any) => g.average != null && g.average !== undefined);
          
          // Lấy 5 môn gần đây có điểm số
          setRecentGrades(validGrades.slice(0, 5));
          
          // Tính điểm TB
          if (validGrades.length > 0) {
            const avg = validGrades.reduce((sum: number, g: any) => sum + (g.average || 0), 0) / validGrades.length;
            setAverageGrade(avg);
          }
          
          setSubjectCount(grades.length);
        }
      } catch (error: any) {
        console.error('Error fetching grades:', error);
      }
    };

    if (studentInfo && currentYear) {
      fetchGrades();
    }
  }, [studentInfo, currentYear, semester]);

  // Lấy thống kê điểm danh
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!studentInfo || !currentYear) return;

      try {
        const studentId = studentInfo._id;
        const res = await attendanceApi.getAttendanceStats({
          studentId,
          schoolYear: currentYear,
          semester,
        });

        if (res.success && res.data) {
          const { present = 0, absent = 0, late = 0 } = res.data;
          const total = present + absent + late;
          if (total > 0) {
            setAttendanceRate(Math.round((present / total) * 100));
          }
        }
      } catch (error: any) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    if (studentInfo && currentYear) {
      fetchAttendance();
    }
  }, [studentInfo, currentYear, semester]);

  const getDayName = (dayOfWeek: number) => {
    const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[dayOfWeek === 0 ? 0 : dayOfWeek - 1] || 'Chủ nhật';
  };

  const today = new Date();
  const todayName = getDayName(today.getDay());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Trang chủ</h1>
        <p className="text-muted-foreground">
          Xin chào, {backendUser?.name || 'Học sinh'}!
        </p>
        {studentInfo?.classId && (
          <Badge variant="outline" className="mt-2">
            {typeof studentInfo.classId === 'object' 
              ? studentInfo.classId?.className 
              : 'Lớp học'}
          </Badge>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Điểm trung bình</p>
                <p className="text-3xl font-bold text-foreground">
                  {loading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    averageGrade.toFixed(1)
                  )}
                </p>
                <p className="text-xs text-success flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Học kỳ I
                </p>
              </div>
              <Award className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tỷ lệ có mặt</p>
                <p className="text-3xl font-bold text-foreground">
                  {loading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    `${attendanceRate}%`
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Năm học {currentYear}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Số môn học</p>
                <p className="text-3xl font-bold text-foreground">
                  {loading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    subjectCount
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Đang theo học</p>
              </div>
              <BookOpen className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule and Recent Grades */}
      <div className={`grid grid-cols-1 ${recentGrades.length > 0 && !loading ? 'lg:grid-cols-2' : ''} gap-6`}>
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Lịch học hôm nay ({todayName})
            </CardTitle>
            <CardDescription>Các tiết học trong ngày</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : todaySchedule.length > 0 ? (
              todaySchedule.map((item) => (
                <div key={item._id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{item.subjectId?.name || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.room ? `Phòng ${item.room}` : ''}
                        {item.teacherId?.name ? ` • ${item.teacherId.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Tiết {item.period}</Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Không có lịch học hôm nay</p>
              </div>
            )}
            {todaySchedule.length > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/student/schedule')}
              >
                Xem toàn bộ thời khóa biểu
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>

        {recentGrades.length > 0 && !loading && (
          <Card className="shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Điểm số gần đây
              </CardTitle>
              <CardDescription>Kết quả học tập các môn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentGrades.map((grade) => (
                <div key={grade._id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-12 h-12 bg-success/10 rounded-lg">
                      <BookOpen className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">{grade.subjectId?.name || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">
                        Học kỳ {grade.semester} - {grade.schoolYear}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      grade.average && grade.average >= 8
                        ? 'default'
                        : grade.average && grade.average >= 6.5
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {grade.average?.toFixed(1) || 'Chưa có'}
                  </Badge>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/student/grades')}
              >
                Xem toàn bộ điểm số
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle>Thao tác nhanh</CardTitle>
          <CardDescription>Các chức năng thường dùng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-auto flex-col p-4"
              onClick={() => navigate('/student/schedule')}
            >
              <Calendar className="h-8 w-8 text-primary mb-2" />
              <p className="text-sm font-medium">Thời khóa biểu</p>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col p-4"
              onClick={() => navigate('/student/grades')}
            >
              <BookOpen className="h-8 w-8 text-success mb-2" />
              <p className="text-sm font-medium">Xem điểm</p>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col p-4"
              onClick={() => navigate('/student/attendance')}
            >
              <CheckCircle className="h-8 w-8 text-warning mb-2" />
              <p className="text-sm font-medium">Điểm danh</p>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col p-4"
              onClick={() => navigate('/student/conduct')}
            >
              <Award className="h-8 w-8 text-accent mb-2" />
              <p className="text-sm font-medium">Hạnh kiểm</p>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboard;

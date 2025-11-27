import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYears } from '@/hooks';
import { Link } from 'react-router-dom';
import api from '@/services/axiosInstance';
import { 
  Users, 
  School, 
  BarChart3,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Award,
  BookOpen,
  ClipboardList,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface HomeroomClass {
  _id: string;
  className: string;
  classCode: string;
  grade: string;
  year: string;
}

interface Student {
  _id: string;
  name: string;
  studentCode: string;
  grades?: {
    hk1Average: number | null;
    hk2Average: number | null;
    yearAverage: number | null;
  };
  conduct?: string;
  academicLevel?: string;
}

interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  excusedDays: number;
  lateDays: number;
  attendanceRate: number;
}

interface GradeStats {
  totalStudents: number;
  excellent: number; // >= 8.0
  good: number; // 6.5 - 7.9
  average: number; // 5.0 - 6.4
  weak: number; // < 5.0
  averageScore: number;
}

export default function HomeroomDashboard() {
  const { backendUser } = useAuth();
  const { currentYear, currentYearData } = useSchoolYears();
  const [loading, setLoading] = useState(true);
  const [homeroomClass, setHomeroomClass] = useState<HomeroomClass | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [gradeStats, setGradeStats] = useState<GradeStats | null>(null);
  const [studentsNeedAttention, setStudentsNeedAttention] = useState<Student[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentYear) return;
      
      try {
        setLoading(true);
        
        // Lấy lớp chủ nhiệm
        const classRes = await api.get('/class/homeroom/classes', { params: { year: currentYear } });
        const homeroomClasses = classRes.data?.data || classRes.data || [];
        if (homeroomClasses.length > 0) {
          const currentClass = homeroomClasses.find((c: any) => c.schoolYear === currentYear)?.class || homeroomClasses[0]?.class;
          setHomeroomClass(currentClass);
          
          if (currentClass?._id) {
            // Lấy danh sách học sinh
            const studentsRes = await api.get('/class/homeroom/students', { params: { year: currentYear } });
            const studentsData = studentsRes.data?.data || [];
            setStudents(studentsData);
            
            // Tính thống kê điểm số
            const stats = calculateGradeStats(studentsData);
            setGradeStats(stats);
            
            // Lấy học sinh cần chú ý
            const needAttention = studentsData.filter((s: Student) => {
              const avg = s.grades?.yearAverage || s.grades?.hk2Average || s.grades?.hk1Average;
              return !avg || avg < 5.0 || s.conduct === 'Yếu' || s.conduct === 'Kém';
            }).slice(0, 5);
            setStudentsNeedAttention(needAttention);
            
            // Lấy thống kê điểm danh
            try {
              const attendanceRes = await api.get('/attendance/stats', {
                params: {
                  classId: currentClass._id,
                  schoolYear: currentYear,
                  semester: '2', // Học kỳ hiện tại
                }
              });
              
              if (attendanceRes.data?.success && attendanceRes.data?.data) {
                const stats = attendanceRes.data.data;
                const totalDays = stats.totalDays || 0;
                const presentDays = stats.presentDays || 0;
                const absentDays = stats.absentDays || 0;
                const excusedDays = stats.excusedDays || 0;
                const lateDays = stats.lateDays || 0;
                const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
                
                setAttendanceStats({
                  totalDays,
                  presentDays,
                  absentDays,
                  excusedDays,
                  lateDays,
                  attendanceRate,
                });
              }
            } catch (err) {
              console.error('Lỗi lấy thống kê điểm danh:', err);
            }
          }
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentYear]);

  const calculateGradeStats = (students: Student[]): GradeStats => {
    let excellent = 0;
    let good = 0;
    let average = 0;
    let weak = 0;
    let totalScore = 0;
    let countWithScore = 0;

    students.forEach((student) => {
      const avg = student.grades?.yearAverage || student.grades?.hk2Average || student.grades?.hk1Average;
      if (avg !== null && avg !== undefined) {
        totalScore += avg;
        countWithScore++;
        
        if (avg >= 8.0) excellent++;
        else if (avg >= 6.5) good++;
        else if (avg >= 5.0) average++;
        else weak++;
      }
    });

    return {
      totalStudents: students.length,
      excellent,
      good,
      average,
      weak,
      averageScore: countWithScore > 0 ? totalScore / countWithScore : 0,
    };
  };

  const getConductStats = () => {
    const stats = {
      excellent: 0,
      good: 0,
      average: 0,
      weak: 0,
    };

    students.forEach((student) => {
      const conduct = student.conduct;
      if (conduct === 'Tốt') stats.excellent++;
      else if (conduct === 'Khá') stats.good++;
      else if (conduct === 'Trung bình') stats.average++;
      else if (conduct === 'Yếu' || conduct === 'Kém') stats.weak++;
    });

    return stats;
  };

  const conductStats = getConductStats();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!homeroomClass) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Giáo viên chủ nhiệm</h1>
          <p className="text-muted-foreground mt-2">Xin chào, {backendUser?.name}!</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <School className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Chưa có lớp chủ nhiệm</h3>
            <p className="text-muted-foreground">
              Nhiệm kỳ này bạn chưa được phân công lớp chủ nhiệm.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Giáo viên chủ nhiệm</h1>
        <p className="text-muted-foreground mt-2">
          Xin chào, {backendUser?.name}! - Lớp: {homeroomClass.className} ({currentYearData?.name || currentYear})
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng học sinh</p>
                <p className="text-3xl font-bold">{students.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Lớp {homeroomClass.className}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Điểm trung bình</p>
                <p className="text-3xl font-bold">
                  {gradeStats?.averageScore ? gradeStats.averageScore.toFixed(1) : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {gradeStats?.excellent || 0} Giỏi, {gradeStats?.good || 0} Khá
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tỷ lệ chuyên cần</p>
                <p className="text-3xl font-bold">
                  {attendanceStats ? `${attendanceStats.attendanceRate.toFixed(1)}%` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {attendanceStats?.presentDays || 0}/{attendanceStats?.totalDays || 0} ngày
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <UserCheck className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Hạnh kiểm tốt</p>
                <p className="text-3xl font-bold">{conductStats.excellent + conductStats.good}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {conductStats.excellent} Tốt, {conductStats.good} Khá
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Award className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grade Distribution & Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Phân loại học lực
            </CardTitle>
            <CardDescription>Thống kê điểm số học sinh</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Giỏi (≥ 8.0)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{gradeStats?.excellent || 0}</span>
                  <span className="text-sm text-muted-foreground">
                    ({gradeStats ? ((gradeStats.excellent / gradeStats.totalStudents) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Khá (6.5 - 7.9)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{gradeStats?.good || 0}</span>
                  <span className="text-sm text-muted-foreground">
                    ({gradeStats ? ((gradeStats.good / gradeStats.totalStudents) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Trung bình (5.0 - 6.4)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{gradeStats?.average || 0}</span>
                  <span className="text-sm text-muted-foreground">
                    ({gradeStats ? ((gradeStats.average / gradeStats.totalStudents) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Yếu (&lt; 5.0)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{gradeStats?.weak || 0}</span>
                  <span className="text-sm text-muted-foreground">
                    ({gradeStats ? ((gradeStats.weak / gradeStats.totalStudents) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserCheck className="h-5 w-5 mr-2" />
              Thống kê điểm danh
            </CardTitle>
            <CardDescription>Chuyên cần học kỳ hiện tại</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceStats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Tổng số ngày</span>
                  <span className="font-semibold">{attendanceStats.totalDays}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Có mặt</span>
                  </div>
                  <span className="font-semibold text-green-600">{attendanceStats.presentDays}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>Vắng mặt</span>
                  </div>
                  <span className="font-semibold text-red-600">{attendanceStats.absentDays}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span>Muộn</span>
                  </div>
                  <span className="font-semibold text-yellow-600">{attendanceStats.lateDays}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                    <span>Có phép</span>
                  </div>
                  <span className="font-semibold text-blue-600">{attendanceStats.excusedDays}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Chưa có dữ liệu điểm danh</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Students Need Attention */}
      {studentsNeedAttention.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-orange-500" />
              Học sinh cần chú ý
            </CardTitle>
            <CardDescription>Những học sinh cần quan tâm đặc biệt</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>STT</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Mã HS</TableHead>
                  <TableHead>Điểm TB</TableHead>
                  <TableHead>Hạnh kiểm</TableHead>
                  <TableHead>Học lực</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsNeedAttention.map((student, index) => {
                  const avg = student.grades?.yearAverage || student.grades?.hk2Average || student.grades?.hk1Average;
                  return (
                    <TableRow key={student._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.studentCode}</TableCell>
                      <TableCell>
                        <Badge variant={avg && avg >= 5.0 ? "default" : "destructive"}>
                          {avg ? avg.toFixed(1) : 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          student.conduct === 'Tốt' ? "default" :
                          student.conduct === 'Khá' ? "secondary" :
                          student.conduct === 'Trung bình' ? "outline" : "destructive"
                        }>
                          {student.conduct || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          student.academicLevel === 'Giỏi' ? "default" :
                          student.academicLevel === 'Khá' ? "secondary" :
                          student.academicLevel === 'Trung bình' ? "outline" : "destructive"
                        }>
                          {student.academicLevel || 'N/A'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4">
              <Link to="/gvcn/homeroom-class" className="text-sm text-primary hover:underline">
                Xem tất cả học sinh →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Thao tác nhanh</CardTitle>
          <CardDescription>Các chức năng thường dùng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/gvcn/homeroom-class">
              <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
                <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Quản lý lớp</p>
              </div>
            </Link>
            <Link to="/gvcn/homeroom-grades">
              <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
                <BarChart3 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Xem điểm số</p>
              </div>
            </Link>
            <Link to="/gvcn/attendance">
              <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
                <UserCheck className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Điểm danh</p>
              </div>
            </Link>
            <Link to="/gvcn/conduct">
              <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
                <Award className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Hạnh kiểm</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


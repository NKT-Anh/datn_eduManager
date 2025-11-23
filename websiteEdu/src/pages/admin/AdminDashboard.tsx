import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useStudents } from '@/hooks/auth/useStudents';
import { useTeachers } from '@/hooks';
import { useClasses } from '@/hooks';
import { useSubjects } from '@/hooks';
import { useSchoolYears } from '@/hooks';
import { 
  Users, 
  School, 
  GraduationCap, 
  UserCheck, 
  TrendingUp,
  Calendar,
  Clock,
  BookOpen,
  Database,
  Settings,
  UserPlus,
  BarChart3,
  CalendarCheck2Icon,
  Shield
} from 'lucide-react';

const AdminDashboard = () => {
  // ✅ Sử dụng hooks để lấy data thực
  const { students = [], isLoading: studentsLoading } = useStudents();
  const { teachers = [], isLoading: teachersLoading } = useTeachers();
  const { classes = [], isLoading: classesLoading } = useClasses();
  const { subjects = [], isLoading: subjectsLoading } = useSubjects();
  const { schoolYears = [], isLoading: yearsLoading } = useSchoolYears();

  const totalStudents = students.length;
  const totalClasses = classes.length;
  const totalTeachers = teachers.length;
  const totalSubjects = subjects.length;
  const activeSchoolYear = schoolYears.find(y => y.isActive);

  const isLoading = studentsLoading || teachersLoading || classesLoading || subjectsLoading || yearsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Quản trị</h1>
        <p className="text-muted-foreground">Tổng quan hệ thống quản lý trường học</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/admin/students">
          <Card className="shadow-card border-border hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tổng học sinh</p>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? '...' : totalStudents}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalClasses > 0 ? `~${Math.round(totalStudents / totalClasses)} HS/lớp` : 'Chưa có lớp'}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/classes">
          <Card className="shadow-card border-border hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tổng lớp học</p>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? '...' : totalClasses}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeSchoolYear ? activeSchoolYear.name : 'Chưa có năm học'}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <School className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/teachers">
          <Card className="shadow-card border-border hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Giáo viên</p>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? '...' : totalTeachers}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Đang hoạt động
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <GraduationCap className="h-8 w-8 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/subjects">
          <Card className="shadow-card border-border hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Môn học</p>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? '...' : totalSubjects}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tổng số môn
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <BookOpen className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle>Thao tác nhanh</CardTitle>
          <CardDescription>Các chức năng quản trị thường dùng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/admin/batch">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <UserPlus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Tạo tài khoản</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Tạo tài khoản hàng loạt cho học sinh, giáo viên
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/school-years">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Database className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Năm học</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Quản lý năm học và học kỳ
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/grades">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Bảng điểm</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Xem và quản lý điểm số học sinh
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/grade-config">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Settings className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Cấu hình điểm</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cấu hình trọng số, làm tròn, xếp loại
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/exam/exam-list">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <CalendarCheck2Icon className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Kỳ thi</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Quản lý kỳ thi và lịch thi
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/permissions">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Shield className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Phân quyền</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Quản lý quyền truy cập người dùng
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
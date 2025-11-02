import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockStudents, mockClasses, mockUsers, mockAttendance } from '@/data/mockData';
import { 
  Users, 
  School, 
  GraduationCap, 
  UserCheck, 
  TrendingUp,
  Calendar,
  Clock
} from 'lucide-react';

const AdminDashboard = () => {
  const totalStudents = mockStudents.length;
  const totalClasses = mockClasses.length;
  const totalTeachers = mockUsers.filter(u => u.role === 'teacher').length;
  const presentToday = mockAttendance.filter(a => a.present).length;
  const attendanceRate = Math.round((presentToday / totalStudents) * 100);

  const todaysSchedule = [
    { time: "07:30", class: "10A1", subject: "Toán học", teacher: "Trần Thị Lan" },
    { time: "08:20", class: "10A2", subject: "Văn học", teacher: "Lê Văn Minh" },
    { time: "09:10", class: "11A1", subject: "Vật lý", teacher: "Trần Thị Lan" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Quản trị</h1>
        <p className="text-muted-foreground">Tổng quan hệ thống quản lý trường học</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng học sinh</p>
                <p className="text-3xl font-bold text-foreground">{totalStudents}</p>
                <p className="text-xs text-success flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +12% từ tháng trước
                </p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng lớp học</p>
                <p className="text-3xl font-bold text-foreground">{totalClasses}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(totalStudents / totalClasses)} HS/lớp
                </p>
              </div>
              <School className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Giáo viên</p>
                <p className="text-3xl font-bold text-foreground">{totalTeachers}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Đang hoạt động
                </p>
              </div>
              <GraduationCap className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tỷ lệ có mặt</p>
                <p className="text-3xl font-bold text-foreground">{attendanceRate}%</p>
                <p className="text-xs text-success flex items-center mt-1">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Hôm nay
                </p>
              </div>
              <UserCheck className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Lịch học hôm nay
            </CardTitle>
            <CardDescription>Tiết học đang diễn ra và sắp tới</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {todaysSchedule.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{item.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.class} - {item.teacher}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{item.time}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle>Thông báo mới</CardTitle>
            <CardDescription>Cập nhật và thông báo quan trọng</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">Họp phụ huynh học kỳ I</p>
                  <p className="text-sm text-muted-foreground">
                    Thông báo tổ chức họp phụ huynh vào cuối tháng 12
                  </p>
                </div>
                <Badge variant="secondary">Mới</Badge>
              </div>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">Cập nhật hệ thống điểm</p>
                  <p className="text-sm text-muted-foreground">
                    Hệ thống đã được cập nhật với tính năng mới
                  </p>
                </div>
                <Badge variant="outline">Hệ thống</Badge>
              </div>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">Kiểm tra định kỳ</p>
                  <p className="text-sm text-muted-foreground">
                    Lịch thi giữa kỳ đã được công bố
                  </p>
                </div>
                <Badge variant="outline">Thi cử</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
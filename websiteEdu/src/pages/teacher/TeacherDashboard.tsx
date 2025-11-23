import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { mockStudents, mockClasses, mockSchedule, mockSubjects } from '@/data/mockData';
import { 
  Users, 
  School, 
  Calendar, 
  Clock,
  BookOpen
} from 'lucide-react';

const TeacherDashboard = () => {
  const { backendUser } = useAuth();
  
  // Get teacher's classes
  const teacherClasses = mockClasses.filter(c => c.teacherId === backendUser?.teacherId || backendUser?._id);
  const totalStudents = teacherClasses.reduce((sum, cls) => {
    return sum + mockStudents.filter(s => s.classId === cls.id).length;
  }, 0);
  
  // Get today's schedule for teacher
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const todaySchedule = mockSchedule.filter(s => 
    s.teacherId === (backendUser?.teacherId || backendUser?._id) && s.dayOfWeek === (today === 0 ? 7 : today + 1)
  );

  const getSubjectName = (subjectId: string) => {
    return mockSubjects.find(s => s.id === subjectId)?.name || 'Không xác định';
  };

  const getClassName = (classId: string) => {
    return mockClasses.find(c => c.id === classId)?.name || 'Không xác định';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Giáo viên</h1>
        <p className="text-muted-foreground">Xin chào, {backendUser?.name}!</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lớp chủ nhiệm</p>
                <p className="text-3xl font-bold text-foreground">{teacherClasses.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Đang quản lý</p>
              </div>
              <School className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng học sinh</p>
                <p className="text-3xl font-bold text-foreground">{totalStudents}</p>
                <p className="text-xs text-muted-foreground mt-1">Đang giảng dạy</p>
              </div>
              <Users className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tiết học hôm nay</p>
                <p className="text-3xl font-bold text-foreground">{todaySchedule.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Theo lịch</p>
              </div>
              <Calendar className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Lịch dạy hôm nay
            </CardTitle>
            <CardDescription>Các tiết học trong ngày</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {todaySchedule.length > 0 ? (
              todaySchedule
                .sort((a, b) => a.period - b.period)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{getSubjectName(item.subjectId)}</p>
                        <p className="text-sm text-muted-foreground">
                          {getClassName(item.classId)} - Phòng {item.room}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">Tiết {item.period}</Badge>
                  </div>
                ))
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Không có lịch dạy hôm nay</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <School className="h-5 w-5 mr-2" />
              Lớp chủ nhiệm
            </CardTitle>
            <CardDescription>Các lớp đang quản lý</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {teacherClasses.length > 0 ? (
              teacherClasses.map((cls) => {
                const studentCount = mockStudents.filter(s => s.classId === cls.id).length;
                return (
                  <div key={cls.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-12 h-12 bg-success/10 rounded-lg">
                        <School className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium">{cls.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Khối {cls.grade}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{studentCount} HS</Badge>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <School className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Chưa được phân công lớp chủ nhiệm</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle>Thao tác nhanh</CardTitle>
          <CardDescription>Các chức năng thường dùng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <BookOpen className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Nhập điểm</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <Users className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm font-medium">Điểm danh</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <Calendar className="h-8 w-8 text-warning mx-auto mb-2" />
              <p className="text-sm font-medium">Xem lịch</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <School className="h-8 w-8 text-accent mx-auto mb-2" />
              <p className="text-sm font-medium">Quản lý lớp</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherDashboard;
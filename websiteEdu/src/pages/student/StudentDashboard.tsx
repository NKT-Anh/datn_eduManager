import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext11';
import { mockStudents, mockClasses, mockSchedule, mockSubjects, mockGrades, mockAttendance } from '@/data/mockData';
import { 
  Calendar, 
  Clock,
  BookOpen,
  TrendingUp,
  CheckCircle,
  Award
} from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  
  // Get student data
  const studentData = mockStudents.find(s => s.id === user?.id);
  const studentClass = mockClasses.find(c => c.id === studentData?.classId);
  const studentGrades = mockGrades.filter(g => g.studentId === user?.id);
  const studentAttendance = mockAttendance.filter(a => a.studentId === user?.id);
  
  // Get today's schedule
  const today = new Date().getDay();
  const todaySchedule = mockSchedule.filter(s => 
    s.classId === studentData?.classId && s.dayOfWeek === (today === 0 ? 7 : today + 1)
  );

  // Calculate stats
  const averageGrade = studentGrades.length > 0
    ? studentGrades.reduce((sum, grade) => sum + (grade.finalExam || 0), 0) / studentGrades.length
    : 0;

  const attendanceRate = studentAttendance.length > 0
    ? Math.round((studentAttendance.filter(a => a.present).length / studentAttendance.length) * 100)
    : 0;

  const getSubjectName = (subjectId: string) => {
    return mockSubjects.find(s => s.id === subjectId)?.name || 'Không xác định';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Học sinh</h1>
        <p className="text-muted-foreground">Xin chào, {user?.name}!</p>
        {studentClass && (
          <Badge variant="outline" className="mt-2">
            Lớp {studentClass.name}
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
                <p className="text-3xl font-bold text-foreground">{averageGrade.toFixed(1)}</p>
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
                <p className="text-3xl font-bold text-foreground">{attendanceRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {studentAttendance.filter(a => a.present).length}/{studentAttendance.length} buổi
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
                <p className="text-3xl font-bold text-foreground">{studentGrades.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Đang theo học</p>
              </div>
              <BookOpen className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule and Recent Grades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Lịch học hôm nay
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
                          Phòng {item.room}
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
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              Điểm số gần đây
            </CardTitle>
            <CardDescription>Kết quả học tập các môn</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentGrades.length > 0 ? (
              studentGrades.slice(0, 4).map((grade) => {
                const subject = mockSubjects.find(s => s.id === grade.subjectId);
                return (
                  <div key={grade.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-12 h-12 bg-success/10 rounded-lg">
                        <BookOpen className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium">{subject?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Học kỳ {grade.semester}
                        </p>
                      </div>
                    </div>
                    <Badge variant={grade.finalExam && grade.finalExam >= 8 ? "default" : grade.finalExam && grade.finalExam >= 6.5 ? "secondary" : "destructive"}>
                      {grade.finalExam?.toFixed(1) || 'Chưa có'}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Chưa có điểm số nào</p>
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
              <Calendar className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Thời khóa biểu</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <BookOpen className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm font-medium">Xem điểm</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <CheckCircle className="h-8 w-8 text-warning mx-auto mb-2" />
              <p className="text-sm font-medium">Điểm danh</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <Award className="h-8 w-8 text-accent mx-auto mb-2" />
              <p className="text-sm font-medium">Thành tích</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboard;
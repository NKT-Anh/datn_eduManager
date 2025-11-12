import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import attendanceApi from '@/services/attendanceApi';
import { 
  ClipboardList,
  Search,
  Calendar,
  Check,
  X,
  Edit,
  Plus,
  User,
  School
} from 'lucide-react';

const AttendancePage = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredAttendance = mockAttendance.filter(attendance => {
    const student = mockStudents.find(s => s.id === attendance.studentId);
    const matchesSearch = student?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = attendance.date === selectedDate;

    if (user?.role === 'student') {
      return attendance.studentId === user.id && matchesDate;
    } else if (user?.role === 'teacher') {
      // Teacher can see attendance for their classes
      const studentInfo = mockStudents.find(s => s.id === attendance.studentId);
      const classInfo = mockClasses.find(c => c.id === studentInfo?.classId);
      return classInfo?.teacherId === user.id && matchesSearch && matchesDate;
    } else {
      return matchesSearch && matchesDate;
    }
  });

  const getStudentName = (studentId: string) => {
    const student = mockStudents.find(s => s.id === studentId);
    return student?.name || 'Unknown';
  };

  const getStudentClass = (studentId: string) => {
    const student = mockStudents.find(s => s.id === studentId);
    const classInfo = mockClasses.find(c => c.id === student?.classId);
    return classInfo?.name || 'Unknown';
  };

  const getTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0];
    return mockAttendance.filter(a => a.date === today);
  };

  const getAttendanceStats = () => {
    const todayAttendance = getTodayAttendance();
    const present = todayAttendance.filter(a => a.present).length;
    const absent = todayAttendance.filter(a => !a.present).length;
    const total = present + absent;
    
    return { present, absent, total };
  };

  const stats = getAttendanceStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {user?.role === 'student' ? 'Lịch sử điểm danh' : 'Quản lý điểm danh'}
          </h1>
          <p className="text-muted-foreground">
            {user?.role === 'student' 
              ? 'Xem lịch sử điểm danh của bạn'
              : 'Quản lý và cập nhật điểm danh học sinh'
            }
          </p>
        </div>
        {(user?.role === 'teacher' || user?.role === 'admin') && (
          <Button className="bg-gradient-primary hover:bg-primary-hover">
            <Plus className="h-4 w-4 mr-2" />
            Điểm danh mới
          </Button>
        )}
      </div>

      {/* Stats */}
      {user?.role !== 'student' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="shadow-card border-border">
            <CardContent className="p-4 text-center">
              <ClipboardList className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Tổng HS hôm nay</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border">
            <CardContent className="p-4 text-center">
              <Check className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats.present}</p>
              <p className="text-sm text-muted-foreground">Có mặt</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border">
            <CardContent className="p-4 text-center">
              <X className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats.absent}</p>
              <p className="text-sm text-muted-foreground">Vắng mặt</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">
                {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%
              </div>
              <p className="text-sm text-muted-foreground">Tỷ lệ có mặt</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="shadow-card border-border">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {user?.role !== 'student' && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm học sinh..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance List */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <span>Điểm danh ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAttendance.length > 0 ? (
            <div className="space-y-3">
              {filteredAttendance.map((attendance) => (
                <div key={attendance.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center space-x-4">
                    {user?.role !== 'student' && (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{getStudentName(attendance.studentId)}</span>
                        <Badge variant="outline">
                          {getStudentClass(attendance.studentId)}
                        </Badge>
                      </div>
                    )}
                    {user?.role === 'student' && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {new Date(attendance.date).toLocaleDateString('vi-VN', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {attendance.present ? (
                        <Badge variant="default" className="bg-success text-success-foreground">
                          <Check className="h-3 w-3 mr-1" />
                          Có mặt
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <X className="h-3 w-3 mr-1" />
                          Vắng mặt
                        </Badge>
                      )}
                    </div>
                    
                    {attendance.reason && (
                      <span className="text-sm text-muted-foreground">
                        Lý do: {attendance.reason}
                      </span>
                    )}
                    
                    {(user?.role === 'teacher' || user?.role === 'admin') && (
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Chưa có dữ liệu điểm danh</h3>
              <p className="text-muted-foreground">
                {user?.role === 'student' 
                  ? 'Chưa có dữ liệu điểm danh cho ngày đã chọn.'
                  : 'Chưa có dữ liệu điểm danh cho ngày và học sinh đã chọn.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student's Monthly Summary */}
      {user?.role === 'student' && (
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <School className="h-5 w-5 text-primary" />
              <span>Tổng kết tháng này</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-800">18</p>
                <p className="text-sm text-green-600">Ngày có mặt</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <X className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-800">2</p>
                <p className="text-sm text-red-600">Ngày vắng mặt</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-800">90%</div>
                <p className="text-sm text-blue-600">Tỷ lệ có mặt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendancePage;
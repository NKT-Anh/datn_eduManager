import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { mockStudents, mockClasses, mockSubjects } from '@/data/mockData';
import { 
  Users, 
  School, 
  BookOpen, 
  Calendar, 
  BarChart3, 
  ClipboardList,
  TrendingUp,
  Award
} from 'lucide-react';

const Dashboard = () => {
  const { backendUser } = useAuth();

  const getStats = () => {
    switch (backendUser?.role) {
      case 'admin':
        return [
          {
            title: 'Tổng học sinh',
            value: mockStudents.length.toString(),
            description: 'Đang theo học',
            icon: Users,
            color: 'text-blue-600'
          },
          {
            title: 'Lớp học',
            value: mockClasses.length.toString(),
            description: 'Đang hoạt động',
            icon: School,
            color: 'text-green-600'
          },
          {
            title: 'Môn học',
            value: mockSubjects.length.toString(),
            description: 'Trong chương trình',
            icon: BookOpen,
            color: 'text-purple-600'
          },
          {
            title: 'Giáo viên',
            value: '12',
            description: 'Đang giảng dạy',
            icon: Award,
            color: 'text-orange-600'
          }
        ];
      
      case 'teacher':
        return [
          {
            title: 'Lớp phụ trách',
            value: '3',
            description: 'Lớp học',
            icon: School,
            color: 'text-blue-600'
          },
          {
            title: 'Học sinh',
            value: '95',
            description: 'Tổng số học sinh',
            icon: Users,
            color: 'text-green-600'
          },
          {
            title: 'Tiết học hôm nay',
            value: '6',
            description: 'Tiết học',
            icon: Calendar,
            color: 'text-purple-600'
          },
          {
            title: 'Điểm chưa nhập',
            value: '8',
            description: 'Bài kiểm tra',
            icon: BarChart3,
            color: 'text-orange-600'
          }
        ];
      
      case 'student':
        return [
          {
            title: 'Lớp học',
            value: '10A1',
            description: 'Lớp hiện tại',
            icon: School,
            color: 'text-blue-600'
          },
          {
            title: 'Điểm TB',
            value: '8.5',
            description: 'Học kỳ 1',
            icon: BarChart3,
            color: 'text-green-600'
          },
          {
            title: 'Tiết học hôm nay',
            value: '6',
            description: 'Tiết học',
            icon: Calendar,
            color: 'text-purple-600'
          },
          {
            title: 'Vắng mặt',
            value: '2',
            description: 'Buổi trong tháng',
            icon: ClipboardList,
            color: 'text-orange-600'
          }
        ];
      
      default:
        return [];
    }
  };

  const stats = getStats();

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    let greeting = 'Chào mừng';
    
    if (hour < 12) greeting = 'Chào buổi sáng';
    else if (hour < 18) greeting = 'Chào buổi chiều';
    else greeting = 'Chào buổi tối';

    return `${greeting}, ${backendUser?.name}!`;
  };

  const getRoleTitle = () => {
    switch (backendUser?.role) {
      case 'admin': return 'Quản trị viên';
      case 'teacher': return 'Giáo viên';
      case 'student': return 'Học sinh';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-primary rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{getWelcomeMessage()}</h1>
            <p className="text-white/90 mt-1">{getRoleTitle()} - Hệ thống quản lý trường học</p>
          </div>
          <div className="hidden md:block">
            <TrendingUp className="h-16 w-16 text-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-card border-border hover:shadow-soft transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.description}</p>
                </div>
                <div className={`p-3 rounded-lg bg-muted`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Lịch hôm nay</span>
            </CardTitle>
            <CardDescription>Thời khóa biểu của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Tiết 1-2: Toán học</p>
                  <p className="text-sm text-muted-foreground">7:00 - 8:30</p>
                </div>
                <span className="text-xs bg-success text-success-foreground px-2 py-1 rounded">Đang diễn ra</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Tiết 3-4: Vật lý</p>
                  <p className="text-sm text-muted-foreground">8:45 - 10:15</p>
                </div>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Sắp tới</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Tiết 5-6: Ngữ văn</p>
                  <p className="text-sm text-muted-foreground">10:30 - 12:00</p>
                </div>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Sắp tới</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span>Thông báo gần đây</span>
            </CardTitle>
            <CardDescription>Cập nhật mới nhất</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                <p className="font-medium text-blue-800">Thông báo kiểm tra</p>
                <p className="text-sm text-blue-600 mt-1">Kiểm tra Toán học vào thứ 5 tuần sau</p>
                <p className="text-xs text-blue-500 mt-1">2 giờ trước</p>
              </div>
              <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                <p className="font-medium text-green-800">Cập nhật điểm</p>
                <p className="text-sm text-green-600 mt-1">Điểm kiểm tra 15 phút Vật lý đã được cập nhật</p>
                <p className="text-xs text-green-500 mt-1">1 ngày trước</p>
              </div>
              <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <p className="font-medium text-yellow-800">Lịch nghỉ</p>
                <p className="text-sm text-yellow-600 mt-1">Nghỉ lễ Quốc khánh từ 2/9 đến 4/9</p>
                <p className="text-xs text-yellow-500 mt-1">3 ngày trước</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Users, 
  UsersRound, 
  School, 
  BookOpen, 
  Calendar, 
  BarChart3,
  ClipboardList,
  CalendarCheck2Icon,
  AlertCircle,
  Bell,
  Database
} from "lucide-react";
import { Link } from "react-router-dom";
import { useStudents } from "@/hooks/auth/useStudents";
import { useTeachers } from "@/hooks";
import { useClasses } from "@/hooks";
import { useSubjects } from "@/hooks";

export default function BGHDashboard() {
  const { backendUser } = useAuth();
  const prefix = "/bgh";
  
  // Fetch data for stats
  const { students = [] } = useStudents();
  const { teachers = [] } = useTeachers();
  const { classes = [] } = useClasses();
  const { subjects = [] } = useSubjects();

  const stats = [
    {
      title: "Học sinh",
      value: students.length.toString(),
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      url: `${prefix}/students`,
    },
    {
      title: "Giáo viên",
      value: teachers.length.toString(),
      icon: UsersRound,
      color: "text-green-600",
      bgColor: "bg-green-100",
      url: `${prefix}/teachers`,
    },
    {
      title: "Lớp học",
      value: classes.length.toString(),
      icon: School,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      url: `${prefix}/classes`,
    },
    {
      title: "Môn học",
      value: subjects.length.toString(),
      icon: BookOpen,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      url: `${prefix}/subjects`,
    },
  ];

  const quickActions = [
    {
      title: "Xem thời khóa biểu",
      description: "Xem thời khóa biểu tất cả lớp",
      icon: Calendar,
      url: `${prefix}/schedule`,
    },
    {
      title: "Xem điểm số",
      description: "Xem điểm số tất cả học sinh",
      icon: BarChart3,
      url: `${prefix}/grades`,
    },
    {
      title: "Xem hạnh kiểm",
      description: "Xem hạnh kiểm học sinh",
      icon: ClipboardList,
      url: `${prefix}/conduct`,
    },
    {
      title: "Quản lý kỳ thi",
      description: "Xem thông tin kỳ thi",
      icon: CalendarCheck2Icon,
      url: `${prefix}/exam/exam-list`,
    },
    {
      title: "Quản lý sự cố",
      description: "Xem và xử lý sự cố",
      icon: AlertCircle,
      url: `${prefix}/incidents`,
    },
    {
      title: "Thông báo",
      description: "Xem và quản lý thông báo",
      icon: Bell,
      url: `${prefix}/notifications`,
    },
    {
      title: "Năm học",
      description: "Xem và quản lý năm học",
      icon: Database,
      url: `${prefix}/school-years`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard - Ban Giám Hiệu</h1>
        <p className="text-muted-foreground mt-2">
          Xem tổng quan thông tin hệ thống
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} to={stat.url}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Thao tác nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.title} to={action.url}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{action.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}








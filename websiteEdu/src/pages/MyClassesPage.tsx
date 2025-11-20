import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/utils/permissions';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { mockClasses, mockStudents, mockSubjects } from '@/data/mockData';
import { 
  School,
  Users,
  BookOpen,
  Eye,
  Edit,
  BarChart3,
  Calendar,
  ClipboardList
} from 'lucide-react';

const MyClassesPageContent = () => {
  const { backendUser } = useAuth();
  const { hasAnyPermission } = usePermissions();

  // Kiểm tra quyền xem lớp (chủ nhiệm hoặc đang dạy)
  const canViewClasses = hasAnyPermission([
    PERMISSIONS.CLASS_VIEW_HOMEROOM,
    PERMISSIONS.CLASS_VIEW_TEACHING,
    PERMISSIONS.CLASS_VIEW
  ]);

  if (!canViewClasses) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Không có quyền truy cập</h2>
          <p className="text-muted-foreground mt-2">Bạn không có quyền truy cập trang này.</p>
        </div>
      </div>
    );
  }

  // Get classes where this teacher is the homeroom teacher
  // TODO: Replace with actual API call
  const homeroomClasses = mockClasses.filter(cls => cls.teacherId === backendUser?._id);
  
  // Get all classes where this teacher teaches (based on subjects)
  const teachingClasses = mockClasses.filter(cls => 
    mockStudents.some(student => student.classId === cls.id)
  );

  const getClassStudentCount = (classId: string) => {
    return mockStudents.filter(student => student.classId === classId).length;
  };

  const getTeachingSubjects = () => {
    // TODO: Replace with actual API call to get teacher's subjects
    return mockSubjects.filter(subject => backendUser?.subjects?.some((s: any) => s === subject.id));
  };

  const teachingSubjects = getTeachingSubjects();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Lớp của tôi</h1>
          <p className="text-muted-foreground">Quản lý các lớp học bạn phụ trách và giảng dạy</p>
        </div>
      </div>

      {/* Teaching Subjects */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Môn học giảng dạy</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {teachingSubjects.map((subject) => (
              <div key={subject.id} className="p-4 bg-gradient-primary text-white rounded-lg text-center">
                <BookOpen className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-semibold">{subject.name}</h3>
                <p className="text-xs opacity-90">Mã: {subject.code}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Homeroom Classes */}
      {homeroomClasses.length > 0 && (
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <School className="h-5 w-5 text-primary" />
              <span>Lớp chủ nhiệm</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {homeroomClasses.map((classItem) => (
                <Card key={classItem.id} className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-primary rounded-lg">
                          <School className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{classItem.name}</h3>
                          <p className="text-sm text-muted-foreground">Khối {classItem.grade}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Học sinh</span>
                      </div>
                      <span className="font-semibold">{getClassStudentCount(classItem.id)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" size="sm">
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Điểm
                      </Button>
                      <Button variant="outline" size="sm">
                        <ClipboardList className="h-3 w-3 mr-1" />
                        Điểm danh
                      </Button>
                      <Button variant="outline" size="sm">
                        <Calendar className="h-3 w-3 mr-1" />
                        Lịch
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Teaching Classes */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Lớp giảng dạy</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachingClasses.map((classItem) => (
              <Card key={classItem.id} className="shadow-card border-border hover:shadow-soft transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <School className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{classItem.name}</h3>
                        <p className="text-sm text-muted-foreground">Khối {classItem.grade}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm">Học sinh</span>
                    </div>
                    <span className="text-sm font-medium">{getClassStudentCount(classItem.id)}</span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Môn giảng dạy:</p>
                    <div className="flex flex-wrap gap-1">
                      {teachingSubjects.map((subject) => (
                        <span 
                          key={subject.id}
                          className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                        >
                          {subject.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      Điểm
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      Lịch
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="shadow-card border-border">
          <CardContent className="p-4 text-center">
            <School className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{homeroomClasses.length}</p>
            <p className="text-sm text-muted-foreground">Lớp chủ nhiệm</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-4 text-center">
            <BookOpen className="h-8 w-8 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{teachingSubjects.length}</p>
            <p className="text-sm text-muted-foreground">Môn giảng dạy</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-4 text-center">
            <Users className="h-8 w-8 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {teachingClasses.reduce((total, cls) => total + getClassStudentCount(cls.id), 0)}
            </p>
            <p className="text-sm text-muted-foreground">Tổng học sinh</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-4 text-center">
            <Calendar className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">24</p>
            <p className="text-sm text-muted-foreground">Tiết/tuần</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const MyClassesPage = () => {
  return (
    <ProtectedRoute
      requiredPermission={[
        PERMISSIONS.CLASS_VIEW_HOMEROOM,
        PERMISSIONS.CLASS_VIEW_TEACHING,
        PERMISSIONS.CLASS_VIEW
      ]}
    >
      <MyClassesPageContent />
    </ProtectedRoute>
  );
};

export default MyClassesPage;
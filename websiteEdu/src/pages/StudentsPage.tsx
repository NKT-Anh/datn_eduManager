import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { mockStudents, mockClasses } from '@/data/mockData';
import { StudentForm } from '@/components/forms/StudentForm';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { Student } from '@/types/school';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Phone,
  Mail,
  MapPin,
  User,
  Filter
} from 'lucide-react';

const StudentsPage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState(mockStudents);
  const [selectedStudent, setSelectedStudent] = useState<Student | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | undefined>();
  const [selectedClass, setSelectedClass] = useState('all');

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.classId === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleCreateStudent = (data: any) => {
    const newStudent: Student = {
      id: `student${students.length + 1}`,
      name: data.name,
      classId: data.classId,
      email: data.email,
      phone: data.phone,
      address: data.address,
      dateOfBirth: data.dateOfBirth,
      parentName: data.parentName,
      parentPhone: data.parentPhone,
    };
    setStudents([...students, newStudent]);
  };

  const handleEditStudent = (data: any) => {
    if (!selectedStudent) return;
    const updatedStudent: Student = {
      ...selectedStudent,
      name: data.name,
      classId: data.classId,
      email: data.email,
      phone: data.phone,
      address: data.address,
      dateOfBirth: data.dateOfBirth,
      parentName: data.parentName,
      parentPhone: data.parentPhone,
    };
    setStudents(students.map(std => std.id === selectedStudent.id ? updatedStudent : std));
    setSelectedStudent(undefined);
  };

  const handleDeleteStudent = () => {
    if (!deletingStudent) return;
    setStudents(students.filter(std => std.id !== deletingStudent.id));
    toast({
      title: 'Xóa thành công',
      description: `Học sinh ${deletingStudent.name} đã được xóa.`,
    });
    setDeletingStudent(undefined);
    setIsDeleteDialogOpen(false);
  };

  const openEditForm = (student: Student) => {
    setSelectedStudent(student);
    setIsFormOpen(true);
  };

  const openDeleteDialog = (student: Student) => {
    setDeletingStudent(student);
    setIsDeleteDialogOpen(true);
  };

  const getClassName = (classId: string) => {
    const classInfo = mockClasses.find(c => c.id === classId);
    return classInfo?.name || 'Unknown';
  };

  if (backendUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Không có quyền truy cập</h2>
          <p className="text-muted-foreground mt-2">Bạn không có quyền truy cập trang này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý học sinh</h1>
          <p className="text-muted-foreground">Quản lý thông tin học sinh trong trường</p>
        </div>
        <Button 
          className="bg-gradient-primary hover:bg-primary-hover"
          onClick={() => {
            setSelectedStudent(undefined);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm học sinh
        </Button>
      </div>

      {/* Filters */}
      <Card className="shadow-card border-border">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo tên hoặc email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="all">Tất cả lớp</option>
                {mockClasses.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map((student) => (
          <Card key={student.id} className="shadow-card border-border hover:shadow-soft transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-primary rounded-lg">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{student.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {getClassName(student.classId)}
                    </Badge>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => console.log('View student:', student.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => openEditForm(student)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => openDeleteDialog(student)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {student.email && (
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{student.email}</span>
                </div>
              )}
              {student.phone && (
                <div className="flex items-center space-x-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{student.phone}</span>
                </div>
              )}
              {student.address && (
                <div className="flex items-center space-x-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground truncate">{student.address}</span>
                </div>
              )}
              {student.parentName && (
                <div className="pt-2 border-t border-border">
                  <p className="text-sm font-medium">Phụ huynh: {student.parentName}</p>
                  {student.parentPhone && (
                    <p className="text-xs text-muted-foreground">{student.parentPhone}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <Card className="shadow-card border-border">
          <CardContent className="p-12 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Không tìm thấy học sinh</h3>
            <p className="text-muted-foreground">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="shadow-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Hiển thị {filteredStudents.length} / {students.length} học sinh
            </span>
            <span className="text-muted-foreground">
              {mockClasses.length} lớp học
            </span>
          </div>
        </CardContent>
      </Card>
      
      {/* Forms and Dialogs */}
      <StudentForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        studentData={selectedStudent}
        onSubmit={selectedStudent ? handleEditStudent : handleCreateStudent}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Xác nhận xóa học sinh"
        description={`Bạn có chắc chắn muốn xóa học sinh ${deletingStudent?.name}? Hành động này không thể hoàn tác.`}
        onConfirm={handleDeleteStudent}
      />
    </div>
  );
};

export default StudentsPage;
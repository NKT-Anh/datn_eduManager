import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { ClassForm } from '@/components/forms/ClassForm';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { ClassType } from '@/types/class';
import { Student } from '@/types/student';
import { Teacher } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, Plus, Edit, Trash2, Eye, School, Users, GraduationCap ,FileSpreadsheet
} from 'lucide-react';
import { classApiNoToken } from '@/services/classApi';
import { getStudents, } from '@/services/studentApi';
import { teacherApi } from '@/services/teacherApi';
import * as XLSX from 'xlsx';
const ClassesPage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [selectedClass, setSelectedClass] = useState<ClassType | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState<ClassType | undefined>();
  type ClassCreatePayload = Omit<ClassType, '_id' | 'teacherId' | 'students' | 'classCode'>;
  const [viewingClass, setViewingClass] = useState<ClassType | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('Tất cả');


  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cls, sts, tchs] = await Promise.all([
          classApiNoToken.getAll(),
          getStudents(),
          teacherApi.getAll()
        ]);
        setClasses(cls);
        setStudents(sts);
        setTeachers(tchs);
      } catch (err) {
        console.error(err);
        toast({ title: 'Lỗi', description: 'Không thể tải dữ liệu', variant: 'destructive' });
      }
    };
    fetchData();
  }, []);
const yearOptions = Array.from(
  new Set(classes.map(cls => cls.year))
).sort((a, b) => b.localeCompare(a)); // Năm mới lên đầu

const filteredClasses = classes.filter(cls => {
  const matchName = cls.className.toLowerCase().includes(searchTerm.toLowerCase());
  const matchYear = selectedYear === 'Tất cả' || cls.year === selectedYear;
  return matchName && matchYear;
});


  // Create / Edit Class
  const handleCreateClass = async (data: any) => {
    try {
      const newCls = await classApiNoToken.create(data);
      setClasses(prev => [...prev, newCls]);
      toast({ title: 'Tạo lớp thành công', description: `Lớp ${newCls.className} đã được tạo` });
      setIsFormOpen(false);
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể tạo lớp', variant: 'destructive' });
    }
  };

const handleEditClass = async (data: any) => {
  if (!selectedClass) return;
  try {
    const updated = await classApiNoToken.update(selectedClass._id, data);
    setClasses(prev => prev.map(cls => cls._id === updated._id ? updated : cls));
    toast({ title: 'Cập nhật thành công', description: `Lớp ${updated.className} đã được cập nhật` });
    setSelectedClass(undefined);
    setIsFormOpen(false);
  } catch (err) {
    toast({ title: 'Lỗi', description: 'Không thể cập nhật lớp', variant: 'destructive' });
  }
};


  const handleDeleteClass = async () => {
    if (!deletingClass) return;
    try {
      await classApiNoToken.delete(deletingClass._id);
      setClasses(prev => prev.filter(cls => cls._id !== deletingClass._id));
      toast({ title: 'Xóa thành công', description: `Lớp ${deletingClass.className} đã được xóa` });
      setDeletingClass(undefined);
      setIsDeleteDialogOpen(false);
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể xóa lớp', variant: 'destructive' });
    }
  };
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const data = new Uint8Array(evt.target?.result as ArrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    // Chỉ đọc sheet đầu tiên
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Chuyển sheet sang JSON
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    // Type payload đúng với API (loại bỏ classCode, backend tự tạo)
    type ClassCreatePayload = Omit<ClassType, '_id' | 'teacherId' | 'students' | 'classCode'>;

    const importedClasses: ClassCreatePayload[] = jsonData
      .map(row => ({
        className: row['Tên lớp']?.toString() || '',
        grade: row['Khối']?.toString() || '',
        year: row['Năm học']?.toString() || '',
        capacity: Number(row['Sĩ số tối đa'] || 0), // giá trị mặc định nếu Excel không có
        currentSize: 0, // bắt đầu là 0 học sinh
      }))
      .filter(cls => cls.className && cls.grade && cls.year); // loại bỏ dòng thiếu dữ liệu

    if (importedClasses.length === 0) {
      toast({ title: 'Thông báo', description: 'Không tìm thấy lớp hợp lệ để thêm', variant: 'destructive' });
      return;
    }

    console.log('Imported Classes:', importedClasses);

    const addedClasses: ClassType[] = [];

    // Duyệt tuần tự để thêm từng lớp
    for (const cls of importedClasses) {
      try {
        const created = await classApiNoToken.create(cls);
        addedClasses.push(created);
      } catch (err) {
        toast({ title: 'Lỗi', description: `Không thể thêm lớp ${cls.className}`, variant: 'destructive' });
      }
    }

    // Cập nhật state 1 lần sau khi thêm xong
    if (addedClasses.length > 0) {
      setClasses(prev => [...prev, ...addedClasses]);
      toast({ title: 'Hoàn tất', description: `Đã thêm ${addedClasses.length} lớp thành công` });
    }
  };

  reader.readAsArrayBuffer(file);
};

    
  
  const openEditForm = (classItem: ClassType) => {
    setSelectedClass(classItem);
    setIsFormOpen(true);
  };

  const openDeleteDialog = (classItem: ClassType) => {
    setDeletingClass(classItem);
    setIsDeleteDialogOpen(true);
  };

  const getClassStudentCount = (classId: string) => {
    return students.filter(s => s.classId === classId).length;
  };
  const openViewDialog = (cls: ClassType) => {
    setViewingClass(cls);
    setIsViewDialogOpen(true);
  };

  const closeViewDialog = () => {
    setViewingClass(null);
    setIsViewDialogOpen(false);
  };

  const getTeacherName = (teacherId?: string | Teacher) => {
  if (!teacherId) return 'Chưa phân công';
  
  // Nếu teacherId là object Teacher
  const id = typeof teacherId === 'string' ? teacherId : teacherId._id;

  const teacher = teachers.find(t => t._id === id);
  return teacher?.name || 'Chưa phân công';
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
        <h1 className="text-3xl font-bold text-foreground">Quản lý lớp học</h1>
        <p className="text-muted-foreground">
          Quản lý thông tin các lớp học trong trường
        </p>
      </div>
      <Button
        className="bg-gradient-primary hover:bg-primary-hover"
        onClick={() => {
          setSelectedClass(undefined);
          setIsFormOpen(true);
        }}
      >
        <Plus className="h-4 w-4 mr-2" /> Tạo lớp học
      </Button>
    </div>

    {/* Bộ công cụ: Tìm kiếm - Import Excel - Lọc năm học */}
    <Card className="shadow-card border-border">
      <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4">
        {/* 🔍 Ô tìm kiếm (bên trái) */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm lớp học..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Bên phải: Import Excel + Bộ lọc năm học */}
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {/* 🔹 Nút Import Excel */}
          <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted transition">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            <span className="font-medium text-sm">Import Excel</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleImportExcel}
            />
          </label>

          {/* 🔹 Bộ lọc năm học */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Năm học:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="Tất cả">Tất cả</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Classes Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredClasses.map((cls) => (
        <Card
          key={cls._id}
          className="shadow-card border-border hover:shadow-soft transition-shadow"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-primary rounded-lg">
                  <School className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">{cls.className}</CardTitle>
                  <Badge variant="outline" className="mt-1">
                    Khối {cls.grade}
                  </Badge>
                </div>
              </div>
              <div className="flex space-x-1">
                <Button variant="ghost" size="icon" onClick={() => openViewDialog(cls)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEditForm(cls)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => openDeleteDialog(cls)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Học sinh</span>
              </div>
              <Badge variant="secondary">
                {getClassStudentCount(cls._id)} học sinh
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">GVCN</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {getTeacherName(cls.teacherId)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    {filteredClasses.length === 0 && (
      <Card className="shadow-card border-border">
        <CardContent className="p-12 text-center">
          <School className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Không tìm thấy lớp học
          </h3>
          <p className="text-muted-foreground">
            Thử thay đổi từ khóa hoặc bộ lọc năm học.
          </p>
        </CardContent>
      </Card>
    )}

    {/* Forms and Dialogs */}
    <ClassForm
      open={isFormOpen}
      onOpenChange={setIsFormOpen}
      classData={selectedClass}
      onSubmit={selectedClass ? handleEditClass : handleCreateClass}
    />
    <DeleteConfirmDialog
      open={isDeleteDialogOpen}
      onOpenChange={setIsDeleteDialogOpen}
      title="Xác nhận xóa lớp học"
      description={`Bạn có chắc chắn muốn xóa lớp ${deletingClass?.className}? Hành động này không thể hoàn tác.`}
      onConfirm={handleDeleteClass}
    />
  </div>
);

};

export default ClassesPage;

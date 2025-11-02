import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StudentForm } from "@/components/forms/StudentForm";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { Student  } from "@/types/student";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Plus, Edit, Trash2, Eye, Users, Phone, Mail, Calendar, MapPin
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStudents, createStudent, updateStudent, deleteStudent, StudentCreatePayload } from "@/services/studentApi";

const StudentsList = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | undefined>();

  // 🔹 Load danh sách từ API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getStudents();
        setStudents(data);
      } catch (error) {
        toast({
          title: "Lỗi tải dữ liệu",
          description: "Không thể tải danh sách học sinh.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.accountId?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🔹 Tạo mới
  const handleCreateStudent = async (data: any) => {
    try {
      const newStudent = await createStudent(data);
      setStudents([...students, newStudent]);
      toast({ title: "Thêm thành công", description: `Học sinh ${newStudent.name} đã được thêm.` });
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể thêm học sinh.", variant: "destructive" });
    }
  };

  // 🔹 Chỉnh sửa
  const handleEditStudent = async (data: any) => {
    if (!selectedStudent) return;
     console.log("Selected Student:", selectedStudent); // check thử
    try {
      const updated = await updateStudent(selectedStudent._id, data);
      setStudents(students.map((s) => (s._id === updated._id ? updated : s)));
      toast({ title: "Cập nhật thành công", description: `Thông tin học sinh đã được cập nhật.` });
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể cập nhật học sinh.", variant: "destructive" });
    }
    setSelectedStudent(undefined);
  };

  // 🔹 Xóa
  const handleDeleteStudent = async () => {
    if (!deletingStudent) return;
    try {
      await deleteStudent(deletingStudent._id);
      setStudents(students.filter((s) => s._id !== deletingStudent._id));
      toast({
        title: "Xóa thành công",
        description: `Học sinh ${deletingStudent.name} đã được xóa.`,
      });
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể xóa học sinh.", variant: "destructive" });
    }
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

  const viewStudentDetail = (student: Student) => {
    navigate(`/admin/students/${student._id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Quản lý học sinh</h1>
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

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên hoặc email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Students Grid */}
      {loading ? (
        <p>Đang tải danh sách học sinh...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map((student) => (
            <Card key={student._id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-primary rounded-lg">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{student.name}</CardTitle>
<Badge variant="outline">
  {student.classId?.className
    ? `${student.classId.className} (${student.classId.grade})`
    : "Chưa phân lớp"}
</Badge>



                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => viewStudentDetail(student)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditForm(student)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => openDeleteDialog(student)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {student.accountId?.email && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="h-4 w-4" />
                    <span>{student.accountId.email}</span>
                  </div>
                )}
                {student.phone && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="h-4 w-4" />
                    <span>{student.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form & Dialog */}
<StudentForm
  open={isFormOpen}
  onOpenChange={setIsFormOpen}
  studentData={
    selectedStudent
      ? ({
          ...selectedStudent,
          classId:
            selectedStudent.classId && typeof selectedStudent.classId === 'object'
              ? selectedStudent.classId._id // chỉ lấy _id
              : selectedStudent.classId || null,
        } as StudentCreatePayload)
      : undefined
  }
  onSubmit={selectedStudent ? handleEditStudent : handleCreateStudent}
/>



      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Xác nhận xóa học sinh"
        description={`Bạn có chắc muốn xóa học sinh ${deletingStudent?.name}?`}
        onConfirm={handleDeleteStudent}
      />
    </div>
  );
};

export default StudentsList;

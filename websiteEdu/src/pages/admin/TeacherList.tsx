import { useEffect, useState, useMemo } from "react";
import { Teacher } from "@/types/auth";
import { ClassType, Subject } from "@/types/class";
import { teacherApi } from "@/services/teacherApi";
import { subjectApi } from "@/services/subjectApi";
import { classApi } from "@/services/classApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, User, Search, Eye } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TeacherForm } from "@/components/forms/TeacherForm";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { TeacherDetailDialog } from "@/components/dialogs/TeacherDetailDialog";
import { ImportTeachersDialog } from "@/components/dialogs/ImportTeacherDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

// ✅ Thêm import cho Recharts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TeacherListProps {
  teachers: Teacher[];
  classes: ClassType[];
  subjects: Subject[];
}

const TeachersList = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { toast } = useToast();

  // Load data
  const loadTeachers = async () => {
    try {
      const data = await teacherApi.getAll();
      setTeachers(data);
    } catch (error) {
      console.error(error);
      toast({ title: "Lỗi", description: "Không thể tải danh sách giáo viên" });
    }
  };

  const loadSubjectsAndClasses = async () => {
    try {
      const [subs, cls] = await Promise.all([
        subjectApi.getSubjects(),
        classApi.getAll(),
      ]);
      setSubjects(subs);
      setClasses(cls);
    } catch (error) {
      console.error(error);
      toast({ title: "Lỗi", description: "Không thể tải môn học hoặc lớp" });
    }
  };

  useEffect(() => {
    loadTeachers();
    loadSubjectsAndClasses();
  }, []);

  const filteredTeachers = useMemo(() => {
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.accountId?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teachers, searchTerm]);

  // Add / Edit / Delete
  const handleAddTeacher = async (data: Omit<Teacher, "_id">) => {
    try {
      await teacherApi.create(data);
      toast({ title: "Thành công", description: "Đã thêm giáo viên" });
      setIsAddDialogOpen(false);
      loadTeachers();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Thêm giáo viên thất bại",
      });
    }
  };

  const handleEditTeacher = async (data: Omit<Teacher, "_id">) => {
    if (!editingTeacher) return;
    try {
      await teacherApi.update(editingTeacher._id!, data);
      toast({ title: "Thành công", description: "Đã cập nhật giáo viên" });
      setEditingTeacher(null);
      loadTeachers();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Cập nhật thất bại",
      });
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deletingTeacher) return;
    try {
      await teacherApi.delete(deletingTeacher._id!);
      toast({ title: "Thành công", description: "Đã xóa giáo viên" });
      setDeletingTeacher(null);
      loadTeachers();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Xóa thất bại",
      });
    }
  };

  const getSubjectNames = (subjectIds: string[]) =>
    subjectIds
      .map((id) => subjects.find((s) => s._id === id)?.name)
      .filter(Boolean)
      .join(", ");

  const getClassNames = (classIds?: any[]) =>
    classIds?.map((cls) => cls.className).filter(Boolean).join(", ");

  const onpenDialog = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsDialogOpen(true);
  };
  const closeDialog = () => {
    setSelectedTeacher(null);
    setIsDialogOpen(false);
  };

  // ✅ Bổ sung: Tính thống kê giáo viên theo môn học
  const subjectStats = useMemo(() => {
    const stats: Record<string, { count: number; grades: Set<string> }> = {};

    teachers.forEach((teacher) => {
      teacher.subjects?.forEach((sub) => {
        const subjectName = sub.subjectId?.name || "Không rõ";
        if (!stats[subjectName])
          stats[subjectName] = { count: 0, grades: new Set() };
        stats[subjectName].count += 1;
        sub.grades?.forEach((g) => stats[subjectName].grades.add(g));
      });
    });

    return Object.entries(stats).map(([subject, { count, grades }]) => ({
      subject,
      count,
      grades: Array.from(grades)
    .sort((a, b) => Number(a) - Number(b))
    .join(", "),
    }));
  }, [teachers]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quản lý giáo viên</h1>
          <p className="text-muted-foreground">
            Quản lý thông tin giáo viên trong hệ thống
          </p>
        </div>

        {/* Nút Import Excel */}
        <ImportTeachersDialog
          subjects={subjects}
          classes={classes}
          onImported={loadTeachers}
        />

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Thêm giáo viên
            </Button>
          </DialogTrigger>
          <TeacherForm
            onSubmit={handleAddTeacher}
            onCancel={() => setIsAddDialogOpen(false)}
            subjects={subjects}
            classes={classes}
          />
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-col items-start gap-2">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Danh sách giáo viên
          </CardTitle>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm giáo viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table className="w-full table-auto">
            <TableHeader>
              <TableRow>
                <TableHead>Mã GV</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Môn dạy</TableHead>
                <TableHead>Lớp phụ trách</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.map((teacher) => (
                <tr key={teacher._id}>
                  <TableCell>{teacher.teacherCode}</TableCell>
                  <TableCell>{teacher.name}</TableCell>
                  <TableCell>{teacher.accountId?.email || "-"}</TableCell>
                  <TableCell>{teacher.phone || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjects && teacher.subjects.length > 0 ? (
                        teacher.subjects.map((sub) => (
                          <Badge key={sub.subjectId._id} variant="secondary">
                            {sub.subjectId.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground italic">
                          Chưa phân công
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {teacher.classIds && teacher.classIds.length > 0 ? (
                        teacher.classIds.map((clsOrId) => {
                          const clsObj =
                            typeof clsOrId === "string"
                              ? classes.find((c) => c._id === clsOrId)
                              : (clsOrId as ClassType);
                          return clsObj ? (
                            <Badge key={clsObj._id} variant="outline">
                              {clsObj.className}
                            </Badge>
                          ) : null;
                        })
                      ) : (
                        <span className="text-muted-foreground italic">
                          Chưa phân lớp giảng dạy
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onpenDialog(teacher)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Dialog
                      open={!!editingTeacher}
                      onOpenChange={() => setEditingTeacher(null)}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTeacher(teacher)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {editingTeacher && (
                        <TeacherForm
                          teacher={editingTeacher}
                          onSubmit={handleEditTeacher}
                          onCancel={() => setEditingTeacher(null)}
                          subjects={subjects}
                          classes={classes}
                        />
                      )}
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingTeacher(teacher)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>

        {/* Summary */}
        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {subjects.length}
                </p>
                <p className="text-sm text-muted-foreground">Tổng môn học</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">
                  {teachers.length}
                </p>
                <p className="text-sm text-muted-foreground">
                  Giáo viên giảng dạy
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">0</p>
                <p className="text-sm text-muted-foreground">Môn tự chọn</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">12</p>
                <p className="text-sm text-muted-foreground">Giáo viên</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ✅ Thống kê trực quan giáo viên theo môn học */}
        <Card className="shadow-card border-border mt-6">
          <CardHeader>
            <CardTitle>Thống kê giáo viên theo môn học</CardTitle>
          </CardHeader>
          <CardContent>
            {subjectStats.length === 0 ? (
              <p className="text-muted-foreground italic">
                Chưa có dữ liệu thống kê
              </p>
            ) : (
              <>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={subjectStats}
                      margin={{ top: 20, right: 20, left: 0, bottom: 40 }}
                    >
                      <XAxis
                        dataKey="subject"
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                        height={80}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="count"
                        name="Số giáo viên"
                        fill="#4f46e5"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Bảng chi tiết */}
                <Table className="mt-6">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Môn học</TableHead>
                      <TableHead>Số giáo viên</TableHead>
                      <TableHead>Khối giảng dạy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjectStats.map((s) => (
                      <TableRow key={s.subject}>
                        <TableCell className="font-medium">{s.subject}</TableCell>
                        <TableCell>{s.count}</TableCell>
                        <TableCell>{s.grades || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </Card>

      <TeacherDetailDialog
        open={isDialogOpen}
        onOpenChange={closeDialog}
        teacher={selectedTeacher}
      />

      <DeleteConfirmDialog
        open={!!deletingTeacher}
        onOpenChange={() => setDeletingTeacher(null)}
        onConfirm={handleDeleteTeacher}
        title="Xóa giáo viên"
        description={`Bạn có chắc chắn muốn xóa giáo viên "${deletingTeacher?.name}"?`}
      />
    </div>
  );
};

export default TeachersList;

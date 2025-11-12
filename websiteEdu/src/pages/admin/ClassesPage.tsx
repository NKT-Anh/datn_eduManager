import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { ClassForm } from "@/components/forms/ClassForm";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { ClassStudentsDialog } from "@/components/dialogs/ClassStudentsDialog";
import { ClassType } from "@/types/class";
import { Teacher } from "@/types/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  GraduationCap,
  FileSpreadsheet,
  Wand2,
  School,
  FileOutput,
} from "lucide-react";
import { classApi, classApiNoToken } from "@/services/classApi";
import { teacherApi } from "@/services/teacherApi";
import * as XLSX from "xlsx";
import { useStudents } from "@/hooks/auth/useStudents";
import { saveAs } from "file-saver";

export default function ClassesPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();

  const [classes, setClasses] = useState<ClassType[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("Tất cả");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassType | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState<ClassType | undefined>();
  const [isStudentsDialogOpen, setIsStudentsDialogOpen] = useState(false);
  const [selectedClassForStudents, setSelectedClassForStudents] =
    useState<ClassType | null>(null);

  const {
    students,
    isLoading: isLoadingStudents,
    autoAssign,
    refetch: refetchStudents,
  } = useStudents();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cls, tchs] = await Promise.all([
          classApi.getAll(),
          teacherApi.getAll(),
        ]);
        setClasses(cls);
        setTeachers(tchs);
      } catch (err) {
        console.error(err);
        toast({
          title: "Lỗi tải dữ liệu",
          description: "Không thể tải danh sách lớp học.",
          variant: "destructive",
        });
      }
    };
    fetchData();
  }, []);

  const yearOptions = useMemo(
    () =>
      Array.from(new Set(classes.map((cls) => cls.year))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [classes]
  );

  const truncateText = (text: string = "", maxLength = 35): string =>
    text.length > maxLength ? text.slice(0, maxLength) + "..." : text;

  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      const matchName = cls.className
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchYear = selectedYear === "Tất cả" || cls.year === selectedYear;
      return matchName && matchYear;
    });
  }, [classes, searchTerm, selectedYear]);

  /* =========================================================
     🎓 CRUD CLASS
  ========================================================== */
  const handleCreateClass = async (data: any) => {
    try {
      const newCls = await classApi.create(data);
      setClasses((prev) => [...prev, newCls]);
      toast({
        title: "✅ Tạo lớp thành công",
        description: `Đã thêm lớp ${newCls.className}`,
      });
      setIsFormOpen(false);
    } catch {
      toast({
        title: "❌ Lỗi",
        description: "Không thể tạo lớp học",
        variant: "destructive",
      });
    }
  };

  const handleEditClass = async (data: any) => {
    if (!selectedClass) return;
    try {
      const updated = await classApi.update(selectedClass._id, data);
      setClasses((prev) =>
        prev.map((cls) => (cls._id === updated._id ? updated : cls))
      );
      toast({
        title: "✅ Cập nhật thành công",
        description: `Đã cập nhật lớp ${updated.className}`,
      });
      setSelectedClass(undefined);
      setIsFormOpen(false);
    } catch {
      toast({
        title: "❌ Lỗi",
        description: "Không thể cập nhật lớp học",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClass = async () => {
    if (!deletingClass) return;
    try {
      await classApiNoToken.delete(deletingClass._id);
      setClasses((prev) =>
        prev.filter((cls) => cls._id !== deletingClass._id)
      );
      toast({
        title: "🗑️ Xóa thành công",
        description: `Lớp ${deletingClass.className} đã bị xóa.`,
      });
    } catch {
      toast({
        title: "❌ Lỗi",
        description: "Không thể xóa lớp học.",
        variant: "destructive",
      });
    } finally {
      setDeletingClass(undefined);
      setIsDeleteDialogOpen(false);
    }
  };

  /* =========================================================
     📥 IMPORT EXCEL
  ========================================================== */
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const imported = (rows as any[])
        .map((r) => ({
          className: r["Tên lớp"]?.trim(),
          grade: r["Khối"]?.trim(),
          year: r["Năm học"]?.trim(),
          capacity: Number(r["Sĩ số tối đa"]) || 45,
          currentSize: 0,
        }))
        .filter((c) => c.className && c.grade && c.year);

      if (!imported.length) {
        toast({
          title: "Không có dữ liệu hợp lệ",
          description: "File Excel không chứa lớp hợp lệ.",
          variant: "destructive",
        });
        return;
      }

      let added = 0;
      for (const cls of imported) {
        try {
          await classApiNoToken.create(cls);
          added++;
        } catch {
          console.warn("❌ Lỗi thêm lớp:", cls.className);
        }
      }

      toast({
        title: "✅ Nhập Excel hoàn tất",
        description: `Đã thêm ${added}/${imported.length} lớp thành công.`,
      });

      const refreshed = await classApi.getAll();
      setClasses(refreshed);
    };

    reader.readAsArrayBuffer(file);
  };

  /* =========================================================
     🪄 PHÂN LỚP TỰ ĐỘNG
  ========================================================== */
  const handleAutoAssign = async () => {
    try {
      const currentYear =
        selectedYear !== "Tất cả"
          ? selectedYear
          : `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      const res = await autoAssign(currentYear);
      toast({
        title: "✅ Phân lớp thành công",
        description:
          res?.message || "Đã chia đều học sinh vào các lớp khối 10.",
      });
      await refetchStudents();
    } catch (err: any) {
      toast({
        title: "❌ Lỗi phân lớp",
        description:
          err?.response?.data?.message || "Không thể phân lớp học sinh.",
        variant: "destructive",
      });
    }
  };

  /* =========================================================
     📤 XUẤT EXCEL
  ========================================================== */
  const handleExportExcel = () => {
    const exportData = classes.map((cls) => ({
      "Tên lớp": cls.className,
      "Khối": cls.grade,
      "Năm học": cls.year,
      "Sĩ số hiện tại": cls.currentSize,
      "Sĩ số tối đa": cls.capacity,
      "Giáo viên chủ nhiệm": getTeacherName(cls.teacherId),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách lớp");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `Danh_sach_lop_${new Date().getFullYear()}.xlsx`
    );
    toast({ title: "✅ Xuất Excel thành công" });
  };

  const getTeacherName = (teacherId?: string | Teacher) => {
    if (!teacherId) return "Chưa phân công";
    const id = typeof teacherId === "string" ? teacherId : teacherId._id;
    const t = teachers.find((x) => x._id === id);
    return t?.name || "Chưa phân công";
  };

  if (backendUser?.role !== "admin") {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg text-muted-foreground">
          🚫 Bạn không có quyền truy cập trang này.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Quản lý lớp học</h1>
          <p className="text-muted-foreground">
            Quản lý thông tin lớp, giáo viên chủ nhiệm và sĩ số học sinh
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Tạo lớp
          </Button>
          <Button variant="outline" onClick={handleAutoAssign}>
            <Wand2 className="h-4 w-4 mr-2" /> Phân lớp tự động
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileOutput className="h-4 w-4 mr-2" /> Xuất Excel
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm lớp học..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted transition">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Import Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportExcel}
              />
            </label>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border rounded-md px-2 py-1 text-sm"
            >
              <option value="Tất cả">Tất cả năm học</option>
              {yearOptions.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Grid lớp học */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map((cls) => (
          <Card key={cls._id} className="hover:shadow-lg transition">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{cls.className}</CardTitle>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">Khối {cls.grade}</Badge>
                    <Badge variant="secondary">{cls.year}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedClass(cls);
                      setIsFormOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      setDeletingClass(cls);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div
                className="flex items-center justify-between p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/70"
                onClick={() => {
                  setSelectedClassForStudents(cls);
                  setIsStudentsDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Học sinh</span>
                </div>
                <Badge
                  variant={
                    cls.currentSize >= cls.capacity
                      ? "destructive"
                      : cls.currentSize >= cls.capacity * 0.8
                      ? "secondary"
                      : "outline"
                  }
                >
                  {cls.currentSize}/{cls.capacity}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 mt-2 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span>GVCN</span>
                </div>
                <span
                  className="text-sm text-muted-foreground truncate max-w-[140px]"
                  title={getTeacherName(cls.teacherId)}
                >
                  {truncateText(getTeacherName(cls.teacherId))}
                </span>
              </div>
              
{/* 🏫 Phòng học */}
<div className="flex items-center justify-between p-2 mt-2 bg-muted rounded-lg">
  <div className="flex items-center gap-2">
    <School className="h-4 w-4 text-primary" />
    <span>Phòng học</span>
  </div>
  <span
    className="text-sm text-muted-foreground truncate max-w-[140px]"
    title={cls.roomId ? cls.roomId.roomCode : "Chưa có"}
  >
    {cls.roomId ? cls.roomId.roomCode : "Chưa có"}
  </span>
</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClasses.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Không tìm thấy lớp học phù hợp.
        </p>
      )}

      {/* Dialogs */}
      <ClassForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        classData={selectedClass}
        onSubmit={selectedClass ? handleEditClass : handleCreateClass}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Xác nhận xóa lớp"
        description={`Bạn có chắc muốn xóa lớp ${deletingClass?.className}?`}
        onConfirm={handleDeleteClass}
      />

      <ClassStudentsDialog
        open={isStudentsDialogOpen}
        onOpenChange={setIsStudentsDialogOpen}
        classItem={selectedClassForStudents}
        students={students}
      />
    </div>
  );
}

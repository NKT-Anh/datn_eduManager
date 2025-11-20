import { useState, useMemo, useEffect } from "react";
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
import { AssignTeacherDialog } from "@/components/dialogs/AssignTeacherDialog";
import { AssignRoomDialog } from "@/components/dialogs/AssignRoomDialog";
import { AutoAssignRoomDialog } from "@/components/dialogs/AutoAssignRoomDialog";
import { AutoAssignHomeroomTeacherDialog } from "@/components/dialogs/AutoAssignHomeroomTeacherDialog";
import { ClassDetailDialog } from "@/components/dialogs/ClassDetailDialog";
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
  Building2,
  Eye,
  Home,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useClasses, useTeachers, useAutoAssignRooms, useAutoAssignHomeroomTeachers } from "@/hooks";
import { classApiNoToken } from "@/services/classApi";
import * as XLSX from "xlsx";
import { useStudents } from "@/hooks/auth/useStudents";
import { saveAs } from "file-saver";
import CreateClassesDialog from "@/components/dialogs/CreateClassesDialog";
import settingApi from "@/services/settingApi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ClassesPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();

  // ✅ Sử dụng hooks
  const { classes, create: createClass, update: updateClass, remove: removeClass, assignRoom: assignRoomToClass, refetch: refetchClasses } = useClasses();
  const { teachers } = useTeachers();
  const autoAssignRoomsMutation = useAutoAssignRooms();
  const autoAssignHomeroomTeachersMutation = useAutoAssignHomeroomTeachers();

  const [selectedYear, setSelectedYear] = useState<string>("Tất cả");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassType | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState<ClassType | undefined>();
  const [isStudentsDialogOpen, setIsStudentsDialogOpen] = useState(false);
  const [selectedClassForStudents, setSelectedClassForStudents] =
    useState<ClassType | null>(null);
  const [isAssignTeacherDialogOpen, setIsAssignTeacherDialogOpen] = useState(false);
  const [selectedClassForTeacher, setSelectedClassForTeacher] =
    useState<ClassType | null>(null);
  const [isAssignRoomDialogOpen, setIsAssignRoomDialogOpen] = useState(false);
  const [selectedClassForRoom, setSelectedClassForRoom] =
    useState<ClassType | null>(null);
  const [isAutoAssignRoomDialogOpen, setIsAutoAssignRoomDialogOpen] = useState(false);
  const [isAutoAssignTeacherDialogOpen, setIsAutoAssignTeacherDialogOpen] = useState(false);
  const [isClassDetailDialogOpen, setIsClassDetailDialogOpen] = useState(false);
  const [selectedClassForDetail, setSelectedClassForDetail] = useState<ClassType | null>(null);
  
  // ✅ State cho phần xem giáo viên chủ nhiệm
  const [currentSchoolYear, setCurrentSchoolYear] = useState<string>("");
  const [isHomeroomViewOpen, setIsHomeroomViewOpen] = useState<boolean>(false);

  const {
    students,
    isLoading: isLoadingStudents,
    autoAssign,
    refetch: refetchStudents,
  } = useStudents();

  const yearOptions = useMemo(
    () =>
      Array.from(new Set(classes.map((cls) => cls.year))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [classes]
  );

  // ✅ Lấy năm học hiện tại từ settings
  useEffect(() => {
    const fetchCurrentYear = async () => {
      try {
        const settings = await settingApi.getSettings();
        const year = settings?.currentSchoolYear || "";
        setCurrentSchoolYear(year);
        setHomeroomViewYear(year); // Mặc định chọn năm học hiện tại
      } catch (error) {
        console.error("Lỗi lấy năm học hiện tại:", error);
      }
    };
    fetchCurrentYear();
  }, []);

  // ✅ Lấy danh sách lớp và giáo viên chủ nhiệm theo năm học (chỉ load khi mở)
  const homeroomClassesData = useMemo(() => {
    // Chỉ tính toán khi phần này được mở
    if (!isHomeroomViewOpen) return [];

    // Sử dụng selectedYear từ toolbar, nếu là "Tất cả" thì dùng currentSchoolYear
    const year = selectedYear === "Tất cả" ? currentSchoolYear : selectedYear;
    if (!year) return [];

    // Lọc lớp theo năm học
    const classesForYear = classes.filter((cls) => cls.year === year);
    
    // Lấy giáo viên chủ nhiệm cho từng lớp
    return classesForYear
      .map((cls) => {
        let homeroomTeacher: Teacher | null = null;

        // Cách 1: Tìm từ class.teacherId (nếu có)
        if (cls.teacherId) {
          const teacherId = typeof cls.teacherId === "string" ? cls.teacherId : cls.teacherId._id;
          homeroomTeacher = teachers.find((t) => t._id === teacherId) || null;
        }

        // Cách 2: Nếu không tìm thấy, tìm giáo viên có currentHomeroomClassId trùng với lớp này
        if (!homeroomTeacher) {
          homeroomTeacher = teachers.find((teacher) => {
            if (!teacher.currentHomeroomClassId) return false;
            const classId = typeof teacher.currentHomeroomClassId === "object"
              ? teacher.currentHomeroomClassId._id
              : teacher.currentHomeroomClassId;
            return classId === cls._id;
          }) || null;
        }

        return {
          class: cls,
          teacher: homeroomTeacher,
        };
      })
      .sort((a, b) => {
        // Sắp xếp theo khối rồi tên lớp
        if (a.class.grade !== b.class.grade) {
          return a.class.grade.localeCompare(b.class.grade);
        }
        return a.class.className.localeCompare(b.class.className);
      });
  }, [classes, teachers, selectedYear, currentSchoolYear, isHomeroomViewOpen]);

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
      // Tách roomId ra để gọi API riêng sau khi tạo lớp
      const { roomId, ...otherData } = data;
      
      const newCls = await createClass(otherData);
      
      // Nếu có roomId, gắn phòng sau khi tạo lớp
      if (roomId) {
        try {
          await assignRoomToClass({ classId: newCls._id, roomId });
        } catch (roomError: any) {
          toast({
            title: "⚠️ Cảnh báo",
            description: roomError.response?.data?.message || "Đã tạo lớp nhưng không thể gắn phòng",
            variant: "destructive",
          });
        }
      }
      
      toast({
        title: "✅ Tạo lớp thành công",
        description: `Đã thêm lớp ${newCls.className}`,
      });
      setIsFormOpen(false);
    } catch (error: any) {
      toast({
        title: "❌ Lỗi",
        description: error.response?.data?.message || "Không thể tạo lớp học",
        variant: "destructive",
      });
    }
  };

  const handleEditClass = async (data: any) => {
    if (!selectedClass) return;
    try {
      // Tách roomId ra để gọi API riêng
      const { roomId, ...otherData } = data;
      
      // Cập nhật thông tin lớp (không bao gồm roomId)
      await updateClass({ id: selectedClass._id, data: otherData });
      
      // Nếu có roomId, gắn phòng riêng
      if (roomId !== undefined) {
        try {
          await assignRoomToClass({ classId: selectedClass._id, roomId: roomId || null });
        } catch (roomError: any) {
          toast({
            title: "⚠️ Cảnh báo",
            description: roomError.response?.data?.message || "Đã cập nhật lớp nhưng không thể gắn phòng",
            variant: "destructive",
          });
        }
      }
      
      toast({
        title: "✅ Cập nhật thành công",
        description: `Đã cập nhật lớp ${selectedClass.className}`,
      });
      setSelectedClass(undefined);
      setIsFormOpen(false);
    } catch (error: any) {
      toast({
        title: "❌ Lỗi",
        description: error.response?.data?.message || "Không thể cập nhật lớp học",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClass = async () => {
    if (!deletingClass) return;
    try {
      await removeClass(deletingClass._id);
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
     🏫 TỰ ĐỘNG GÁN PHÒNG
  ========================================================== */
  const handleAutoAssignRooms = async (reassignAll: boolean = false) => {
    try {
      const year = selectedYear !== "Tất cả" ? selectedYear : undefined;
      const res = await autoAssignRoomsMutation.mutateAsync({ year, reassignAll });
      
      const { assigned, skipped, failed, details } = res;
      
      // Hiển thị thông báo chi tiết
      let description = `Đã gán: ${assigned} lớp`;
      if (skipped > 0) description += `, Bỏ qua: ${skipped} lớp`;
      if (failed > 0) description += `, Lỗi: ${failed} lớp`;
      
      toast({
        title: "✅ Tự động gán phòng",
        description,
        duration: 5000,
      });

      // Log chi tiết vào console
      console.log("📋 Chi tiết gán phòng:", details);

      // Refresh danh sách lớp
      // Hook sẽ tự động refetch sau khi mutation, nhưng có thể gọi thủ công nếu cần
      await refetchClasses();
    } catch (err: any) {
      toast({
        title: "❌ Lỗi tự động gán phòng",
        description:
          err?.response?.data?.message || "Không thể tự động gán phòng.",
        variant: "destructive",
      });
    }
  };

  /* =========================================================
     👩‍🏫 TỰ ĐỘNG GÁN GIÁO VIÊN CHỦ NHIỆM
  ========================================================== */
  const handleAutoAssignHomeroomTeachers = async (reassignAll: boolean = false) => {
    try {
      const year = selectedYear !== "Tất cả" ? selectedYear : undefined;
      const res = await autoAssignHomeroomTeachersMutation.mutateAsync({ year, reassignAll });
      
      const { assigned, skipped, failed, details } = res;
      
      // Hiển thị thông báo chi tiết
      let description = `Đã gán: ${assigned} lớp`;
      if (skipped > 0) description += `, Bỏ qua: ${skipped} lớp`;
      if (failed > 0) description += `, Lỗi: ${failed} lớp`;
      
      toast({
        title: "✅ Tự động gán GVCN",
        description,
        duration: 5000,
      });

      // Log chi tiết vào console
      console.log("📋 Chi tiết gán GVCN:", details);
    } catch (err: any) {
      toast({
        title: "❌ Lỗi tự động gán GVCN",
        description:
          err?.response?.data?.message || "Không thể tự động gán GVCN.",
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
          <CreateClassesDialog onClassesCreated={async () => {
            await refetchClasses();
          }} />
          <Button variant="outline" onClick={handleAutoAssign}>
            <Wand2 className="h-4 w-4 mr-2" /> Phân lớp tự động
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsAutoAssignRoomDialogOpen(true)}
            title="Tự động gán phòng có code trùng với tên lớp"
          >
            <Building2 className="h-4 w-4 mr-2" /> Tự động gán phòng
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsAutoAssignTeacherDialogOpen(true)}
            title="Tự động gán giáo viên chủ nhiệm (ưu tiên Văn, Toán)"
          >
            <GraduationCap className="h-4 w-4 mr-2" /> Tự động gán GVCN
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

      {/* ✅ Phần xem giáo viên chủ nhiệm */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle 
              className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsHomeroomViewOpen(!isHomeroomViewOpen)}
            >
              <Home className="h-5 w-5" />
              Giáo viên chủ nhiệm theo lớp
              {isHomeroomViewOpen ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </CardTitle>
          </div>
        </CardHeader>
        {isHomeroomViewOpen && (
          <CardContent>
          {homeroomClassesData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {selectedYear === "Tất cả" 
                ? (currentSchoolYear 
                    ? `Không có lớp nào trong năm học ${currentSchoolYear}`
                    : "Vui lòng chọn năm học")
                : `Không có lớp nào trong năm học ${selectedYear}`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Khối</TableHead>
                    <TableHead>Giáo viên chủ nhiệm</TableHead>
                    <TableHead>Mã GV</TableHead>
                    <TableHead>Sĩ số</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {homeroomClassesData.map(({ class: cls, teacher }) => (
                    <TableRow key={cls._id}>
                      <TableCell className="font-medium">{cls.className}</TableCell>
                      <TableCell>
                        <Badge variant="outline">Khối {cls.grade}</Badge>
                      </TableCell>
                      <TableCell>
                        {teacher ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="default">
                              <Home className="h-3 w-3 mr-1 inline" />
                              {teacher.name}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Chưa phân công</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {teacher?.teacherCode || (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          </CardContent>
        )}
      </Card>

      {/* Grid lớp học */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map((cls) => (
          <Card 
            key={cls._id} 
            className="hover:shadow-lg transition cursor-pointer"
            onClick={() => {
              setSelectedClassForDetail(cls);
              setIsClassDetailDialogOpen(true);
            }}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle>{cls.className}</CardTitle>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">Khối {cls.grade}</Badge>
                    <Badge variant="secondary">{cls.year}</Badge>
                  </div>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedClassForDetail(cls);
                      setIsClassDetailDialogOpen(true);
                    }}
                    title="Xem chi tiết"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedClass(cls);
                      setIsFormOpen(true);
                    }}
                    title="Chỉnh sửa"
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
                    title="Xóa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent onClick={(e) => e.stopPropagation()}>
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

              <div 
                className="flex items-center justify-between p-2 mt-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/70"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedClassForTeacher(cls);
                  setIsAssignTeacherDialogOpen(true);
                }}
              >
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
<div 
  className="flex items-center justify-between p-2 mt-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/70"
  onClick={(e) => {
    e.stopPropagation();
    setSelectedClassForRoom(cls);
    setIsAssignRoomDialogOpen(true);
  }}
>
  <div className="flex items-center gap-2">
    <School className="h-4 w-4 text-primary" />
    <span>Phòng học</span>
  </div>
  <span
    className="text-sm text-muted-foreground truncate max-w-[140px]"
    title={cls.roomId ? (typeof cls.roomId === 'object' ? cls.roomId.roomCode : cls.roomId) : "Chưa có phòng học"}
  >
    {cls.roomId ? (typeof cls.roomId === 'object' ? cls.roomId.roomCode : cls.roomId) : "Chưa có phòng học"}
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

      <AssignTeacherDialog
        open={isAssignTeacherDialogOpen}
        onOpenChange={setIsAssignTeacherDialogOpen}
        classItem={selectedClassForTeacher}
        onSuccess={async () => {
          await refetchClasses();
        }}
      />

      <AssignRoomDialog
        open={isAssignRoomDialogOpen}
        onOpenChange={setIsAssignRoomDialogOpen}
        classItem={selectedClassForRoom}
        onSuccess={async () => {
          await refetchClasses();
        }}
      />

      <AutoAssignRoomDialog
        open={isAutoAssignRoomDialogOpen}
        onOpenChange={setIsAutoAssignRoomDialogOpen}
        onConfirm={handleAutoAssignRooms}
      />

      <AutoAssignHomeroomTeacherDialog
        open={isAutoAssignTeacherDialogOpen}
        onOpenChange={setIsAutoAssignTeacherDialogOpen}
        onConfirm={handleAutoAssignHomeroomTeachers}
      />

      <ClassDetailDialog
        open={isClassDetailDialogOpen}
        onOpenChange={setIsClassDetailDialogOpen}
        classItem={selectedClassForDetail}
        students={students}
        teachers={teachers}
      />
    </div>
  );
}

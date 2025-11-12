import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wand2, ArrowUpDown, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { StudentForm } from "@/components/forms/StudentForm";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import type { StudentExcelRow, StudentImportPayload } from "@/types/student";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Users,
  Mail,
  Phone,
  Filter,
  PieChart,
  BookOpen,
  School,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash";
import { useStudents } from "@/hooks/auth/useStudents";
import schoolConfigApi from "@/services/schoolConfigApi";
import { classApi } from "@/services/classApi";
import { StudentCreatePayload } from "@/services/studentApi";
import { Student } from "@/types/auth";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import settingApi from "@/services/settingApi";

interface GroupedClass {
  grade: string;
  classes: { _id: string; className: string }[];
}

export default function StudentsList() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // ===============================
  // ⚙️ State
  // ===============================
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [schoolYears, setSchoolYears] = useState<{ code: string; name: string }[]>([]);
  const [groupedClasses, setGroupedClasses] = useState<GroupedClass[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [sortField, setSortField] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [currentSchoolYear, setCurrentSchoolYear] = useState<string>("");


  // ===============================
  // 📦 Dữ liệu học sinh (React Query)
  // ===============================
  const { students, isLoading, refetch, create, update, remove, autoAssign } = useStudents();

  // ===============================
  // ⚙️ Tải cấu hình trường học + lớp
  // ===============================
  const fetchSchoolConfigs = useCallback(async () => {
    try {
      const res = await schoolConfigApi.getSchoolYears();
      setSchoolYears(res.data || res || []);
    } catch {
      toast({
        title: "Lỗi tải dữ liệu",
        description: "Không thể tải danh sách niên khóa.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchGroupedClasses = useCallback(async (year?: string) => {
    if (!year) return setGroupedClasses([]);
    try {
      const res = await classApi.getGradesAndClassesByYear(year);
      setGroupedClasses(res || []);
    } catch {
      toast({
        title: "Lỗi tải lớp học",
        description: `Không thể tải danh sách lớp của năm ${year}`,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchSchoolConfigs();
  }, [fetchSchoolConfigs]);

  useEffect(() => {
    if (selectedYear) fetchGroupedClasses(selectedYear);
    else setGroupedClasses([]);
    setSelectedGrade("");
    setSelectedClass("");
  }, [selectedYear, fetchGroupedClasses]);
useEffect(() => {
  const fetchSetting = async () => {
    try {
      const res = await settingApi.getSettings();
      setCurrentSchoolYear(res.data?.currentSchoolYear || "");
    } catch {
      toast({
        title: "⚠️ Lỗi tải cấu hình trường",
        description: "Không thể lấy năm học hiện tại từ hệ thống.",
        variant: "destructive",
      });
    }
  };

  fetchSetting();
}, [toast]);
  // ===============================
  // 🔍 Lọc + tìm kiếm + sắp xếp
  // ===============================
  const debouncedSearch = useMemo(() => debounce((v: string) => setSearchTerm(v), 300), []);

  const getNestedValue = (obj: any, path: string): any =>
    path.split(".").reduce((acc, part) => acc?.[part], obj);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let result = students.filter((s) => {
      const matchSearch =
        !term ||
        s.name?.toLowerCase().includes(term) ||
        s.studentCode?.toLowerCase().includes(term) ||
        s.accountId?.email?.toLowerCase().includes(term);

      const matchYear = selectedYear === "0" || !selectedYear || s.currentYear === selectedYear;
      const matchGrade = selectedGrade === "0" || !selectedGrade || s.grade === selectedGrade;
      const matchClass = selectedClass === "0" || !selectedClass || s.classId?._id === selectedClass;
      const matchStatus = selectedStatus === "0" || !selectedStatus || s.status === selectedStatus;

      return matchSearch && matchYear && matchGrade && matchClass && matchStatus;
    });

    // Sắp xếp
    if (sortField) {
      result = [...result].sort((a, b) => {
        let valA = getNestedValue(a, sortField);
        let valB = getNestedValue(b, sortField);

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [students, searchTerm, selectedYear, selectedGrade, selectedClass, selectedStatus, sortField, sortOrder]);

  // ===============================
  // 📊 Thống kê nhanh
  // ===============================
  const totalStudents = filteredStudents.length;
  const activeCount = filteredStudents.filter((s) => s.status === "active").length;
  const inactiveCount = filteredStudents.filter((s) => s.status === "inactive").length;
  const classCount = new Set(filteredStudents.map((s) => s.classId?._id).filter(Boolean)).size;

  // ===============================
  // ⚙️ Auto assign
  // ===============================
  const handleAutoAssign = async () => {
    try {
      const currentYear = currentSchoolYear || "2025-2026";

      const res = await autoAssign(currentYear);
      toast({ title: "✅ Phân lớp thành công", description: res?.message });
      refetch();
    } catch (err: any) {
      toast({
        title: "❌ Lỗi phân lớp",
        description: err?.response?.data?.message || "Không thể phân lớp học sinh.",
        variant: "destructive",
      });
    }
  };

  // ===============================
  // 📤 Export Excel
  // ===============================
const handleExportExcel = () => {
  if (!filteredStudents.length) {
    toast({
      title: "Không có dữ liệu",
      description: "Không có học sinh nào để xuất.",
      variant: "destructive",
    });
    return;
  }

  const exportData: StudentExcelRow[] = filteredStudents.map((s, idx) => ({
    STT: idx + 1,
    "Mã học sinh": s.studentCode || "",
    "Họ tên": s.name,
    "Giới tính":
      s.gender === "male" ? "Nam" : s.gender === "female" ? "Nữ" : "Khác",
    "Ngày sinh": s.dob ? new Date(s.dob).toLocaleDateString("vi-VN") : "",
    "Khối": s.grade || "",
    "Lớp": s.classId?.className || "",
    "Năm nhập học": s.admissionYear || "",
    "Năm học hiện tại": s.currentYear || "",
    "Trạng thái":
      s.status === "active"
        ? "Đang học"
        : s.status === "inactive"
        ? "Nghỉ học"
        : s.status === "graduated"
        ? "Tốt nghiệp"
        : "Khác",
    "Số điện thoại": s.phone || "",
    "Địa chỉ": s.address || "",
    "Email": s.accountId?.email || "",
    "Dân tộc": s.ethnic || "",
    "Tôn giáo": s.religion || "",
    "CCCD": s.idNumber || "",
    "Nơi sinh": s.birthPlace || "",
    "Quê quán": s.hometown || "",
    "Ghi chú": s.note || "",
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Học sinh");

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `Danh_sach_hoc_sinh_${new Date().getFullYear()}.xlsx`);
  toast({ title: "✅ Xuất Excel thành công" });
};


  // ===============================
  // 📥 Import Excel
  // ===============================
const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const data = new Uint8Array(event.target?.result as ArrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: StudentExcelRow[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      toast({ title: "❌ File trống", variant: "destructive" });
      return;
    }

    try {
      for (const row of rows) {
        const payload: StudentImportPayload = {
          studentCode: row["Mã học sinh"] || "",
          name: row["Họ tên"],
          gender:
            row["Giới tính"] === "Nam"
              ? "male"
              : row["Giới tính"] === "Nữ"
              ? "female"
              : "other",
          dob: row["Ngày sinh"]
            ? (() => {
                const parts = row["Ngày sinh"].split(/[\/\-]/);
                if (parts.length === 3) {
                  const [d, m, y] = parts.map((p) => parseInt(p, 10));
                  if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                    return new Date(y, m - 1, d).toISOString();
                  }
                }
                return undefined;
              })()
            : undefined,
          grade: (row["Khối"] || "10") as "10" | "11" | "12",
          admissionYear: row["Năm nhập học"] || new Date().getFullYear(),
          currentYear: row["Năm học hiện tại"] || currentSchoolYear,

          phone: row["Số điện thoại"] || "",
          address: row["Địa chỉ"] || "",
          status:
            row["Trạng thái"] === "Đang học"
              ? "active"
              : row["Trạng thái"] === "Nghỉ học"
              ? "inactive"
              : row["Trạng thái"] === "Tốt nghiệp"
              ? "graduated"
              : "transferred",
          ethnic: row["Dân tộc"] || "",
          religion: row["Tôn giáo"] || "",
          idNumber: row["CCCD"] || "",
          birthPlace: row["Nơi sinh"] || "",
          hometown: row["Quê quán"] || "",
          note: row["Ghi chú"] || "",
        };

        await create(payload);
      }

      toast({
        title: "✅ Import thành công",
        description: `Đã thêm ${rows.length} học sinh.`,
      });
      refetch();
    } catch (err) {
      console.error(err);
      toast({
        title: "❌ Import thất bại",
        description: "Vui lòng kiểm tra lại dữ liệu hoặc định dạng file.",
        variant: "destructive",
      });
    }
  };
  reader.readAsArrayBuffer(file);
};


  // ===============================
  // 📄 Download Excel Template
  // ===============================
const handleDownloadTemplate = () => {
  const headers = [
    "Mã học sinh",
    "Họ tên",
    "Giới tính",
    "Ngày sinh",
    "Khối",
    "Năm nhập học",
    "Năm học hiện tại",
    "Số điện thoại",
    "Địa chỉ",
    "Trạng thái",
    "Email",
    "Dân tộc",
    "Tôn giáo",
    "CCCD",
    "Nơi sinh",
    "Quê quán",
    "Ghi chú",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mẫu nhập học sinh");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buffer]), "Mau_nhap_hoc_sinh.xlsx");
  toast({ title: "📄 Mẫu Excel đã tải xuống" });
};


  // ===============================
  // CRUD
  // ===============================
  const handleCreate = async (data: StudentCreatePayload) => {
    try {
      await create(data);
      toast({ title: "✅ Thêm học sinh thành công" });
      refetch();
      setIsFormOpen(false);
    } catch {
      toast({ title: "❌ Lỗi thêm học sinh", variant: "destructive" });
    }
  };

  const handleEdit = async (data: StudentCreatePayload) => {
    if (!selectedStudent) return;
    try {
      await update({ id: selectedStudent._id, data });
      toast({ title: "✅ Cập nhật học sinh thành công" });
      refetch();
      setIsFormOpen(false);
    } catch {
      toast({ title: "❌ Lỗi cập nhật học sinh", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingStudent) return;
    try {
      await remove(deletingStudent._id);
      toast({ title: "🗑️ Xóa thành công" });
      refetch();
    } catch {
      toast({ title: "❌ Lỗi xóa học sinh", variant: "destructive" });
    } finally {
      setDeletingStudent(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const viewDetail = (s: Student) => navigate(`/admin/students/${s._id}`);

  // ===============================
  // 🧱 UI
  // ===============================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Quản lý học sinh</h1>
          <p className="text-muted-foreground">Lọc, sắp xếp, nhập/xuất Excel, và phân lớp tự động</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleAutoAssign}>
            <Wand2 className="h-4 w-4 mr-2" /> Phân lớp tự động
          </Button>

          <Button onClick={() => { setSelectedStudent(null); setIsFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Thêm học sinh
          </Button>

          <Button variant="outline" onClick={handleExportExcel}>📤 Xuất Excel</Button>

          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Tải mẫu Excel
          </Button>

          <div>
            <input
              type="file"
              accept=".xlsx,.xls"
              id="importExcel"
              style={{ display: "none" }}
              onChange={handleImportExcel}
            />
            <Button variant="outline" onClick={() => document.getElementById("importExcel")?.click()}>
              📥 Nhập Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="flex items-center gap-3 py-3"><Users className="h-6 w-6 text-primary" /><div><p className="text-sm text-muted-foreground">Tổng học sinh</p><p className="text-2xl font-semibold">{totalStudents}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-3"><BookOpen className="h-6 w-6 text-green-600" /><div><p className="text-sm text-muted-foreground">Đang học</p><p className="text-2xl font-semibold">{activeCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-3"><PieChart className="h-6 w-6 text-gray-500" /><div><p className="text-sm text-muted-foreground">Ngưng học</p><p className="text-2xl font-semibold">{inactiveCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-3"><School className="h-6 w-6 text-blue-600" /><div><p className="text-sm text-muted-foreground">Số lớp</p><p className="text-2xl font-semibold">{classCount}</p></div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Input placeholder="🔍 Tìm kiếm theo tên, mã, email..." onChange={(e) => debouncedSearch(e.target.value)} className="flex-1 min-w-[220px]" />

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tất cả năm học" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Tất cả năm học</SelectItem>
              {schoolYears.map((y) => (<SelectItem key={y.code} value={y.code}>{y.name}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tất cả khối" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Tất cả khối</SelectItem>
              {groupedClasses.map((g) => (<SelectItem key={g.grade} value={g.grade}>Khối {g.grade}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tất cả lớp" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Tất cả lớp</SelectItem>
              {groupedClasses.map((g) => (
                <SelectGroup key={g.grade}>
                  <SelectLabel>Khối {g.grade}</SelectLabel>
                  {g.classes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.className}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Tất cả</SelectItem>
              <SelectItem value="active">Đang học</SelectItem>
              <SelectItem value="inactive">Ngưng học</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select
            value={sortField}
            onValueChange={(v) => {
              setSortField(v);
              setSortOrder("asc");
            }}
          >
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sắp xếp theo..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Họ tên</SelectItem>
              <SelectItem value="studentCode">Mã học sinh</SelectItem>
              <SelectItem value="admissionYear">Năm nhập học</SelectItem>
              <SelectItem value="classId.className">Lớp học</SelectItem>
              <SelectItem value="status">Trạng thái</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            disabled={!sortField}
            onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
          >
            <ArrowUpDown className="h-4 w-4 mr-1" />
            {sortOrder === "asc" ? "Tăng dần" : "Giảm dần"}
          </Button>

          <Button variant="outline" onClick={() => refetch()}>
            <Filter className="h-4 w-4 mr-2" /> Làm mới
          </Button>
        </CardContent>
      </Card>

      {/* Danh sách */}
      {isLoading ? (
        <p className="text-center text-muted-foreground">Đang tải dữ liệu...</p>
      ) : filteredStudents.length === 0 ? (
        <p className="text-center text-muted-foreground">Không tìm thấy học sinh phù hợp.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStudents.map((s) => (
            <Card key={s._id} className="hover:shadow-lg transition">
              <CardHeader className="pb-2 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-primary rounded-lg"><Users className="text-white" /></div>
                  <div>
  <CardTitle className="text-lg font-semibold">{s.name}</CardTitle>
<div className="flex flex-wrap gap-2 mt-1">
  <Badge className="bg-blue-100 text-blue-700">Mã: {s.studentCode}</Badge>
  <Badge variant="secondary">Khối {s.grade}</Badge>
  <Badge variant="outline">{s.classId?.className ?? "Chưa phân lớp"}</Badge>
</div>

  {s.status === "inactive" && (
    <Badge className="ml-2 bg-gray-200 text-gray-600">Ngưng học</Badge>
  )}
</div>

                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => viewDetail(s)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedStudent(s); setIsFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setDeletingStudent(s); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {s.accountId?.email && (<div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {s.accountId.email}</div>)}
                {s.phone && (<div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {s.phone}</div>)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal & Dialog */}
      <StudentForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        studentData={selectedStudent ? { ...selectedStudent, classId: selectedStudent.classId?._id ?? null } : undefined}
        onSubmit={selectedStudent ? handleEdit : handleCreate}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Xác nhận xóa học sinh"
        description={`Bạn có chắc muốn xóa học sinh ${deletingStudent?.name}?`}
        onConfirm={handleDelete}
      />
    </div>
  );
}

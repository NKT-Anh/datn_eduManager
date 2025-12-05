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
  ArrowLeftRight,
  History,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash";
import { useStudents, useStudentTransferHistory } from "@/hooks/auth/useStudents";
import { useAuth } from "@/contexts/AuthContext";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSchoolYears } from "@/hooks";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";
import { classApi } from "@/services/classApi";
import { StudentCreatePayload } from "@/services/studentApi";
import { Student } from "@/types/auth";
import type { ClassType } from "@/types/class";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface GroupedClass {
  grade: string;
  classes: ClassType[];
}

export default function StudentsList() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // ===============================
  // ⚙️ State
  // ===============================
  const [searchTerm, setSearchTerm] = useState<string>("");
  // ✅ Sử dụng hooks
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { currentYearCode } = useCurrentAcademicYear();
  const schoolYears = useMemo(() => 
    allSchoolYears.map(y => ({ code: y.code, name: y.name })),
    [allSchoolYears]
  );
  const [groupedClasses, setGroupedClasses] = useState<GroupedClass[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("active"); // Mặc định "Đang học"

  const [sortField, setSortField] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [transferYear, setTransferYear] = useState<string>("");
  const [transferGrade, setTransferGrade] = useState<string>("");
  const [transferClassId, setTransferClassId] = useState<string>("");
  const [transferReason, setTransferReason] = useState<string>("");
  const [transferClasses, setTransferClasses] = useState<GroupedClass[]>([]);
  const [isLoadingTransferClasses, setIsLoadingTransferClasses] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  const { backendUser } = useAuth();
  const effectivePermissions = backendUser?.effectivePermissions ?? [];
  const canCreateStudent = effectivePermissions.includes("student:create");
  const canUpdateStudent = effectivePermissions.includes("student:update");
  const canDeleteStudent = effectivePermissions.includes("student:delete");
  const canManageStudents = canUpdateStudent;
  const canTransferStudent = canManageStudents;
  const canAutoAssignStudents = canManageStudents;
  const rawHomeroomClassId = backendUser?.teacherFlags?.currentHomeroomClassId;
  const homeroomClassId =
    typeof rawHomeroomClassId === "string" && rawHomeroomClassId
      ? rawHomeroomClassId
      : null;
  const isHomeroomReadOnly =
    backendUser?.role === "teacher" &&
    backendUser?.teacherFlags?.isHomeroom === true &&
    !canManageStudents;
  const restrictedClassId = isHomeroomReadOnly && homeroomClassId ? homeroomClassId : null;
  const studentsQueryParams = restrictedClassId ? { classId: restrictedClassId } : undefined;
  const canOpenCreateForm = canCreateStudent && !isHomeroomReadOnly;
  const canPerformEdits = canManageStudents && !isHomeroomReadOnly;
  const canPerformDeletes = canDeleteStudent && !isHomeroomReadOnly;
  const canImportStudents = canOpenCreateForm;
  const canUseStudentForm = canOpenCreateForm || canPerformEdits;

  const showPermissionDeniedToast = useCallback(() => {
    toast({
      title: "Không có quyền",
      description: "Bạn không được phép thực hiện thao tác này.",
      variant: "destructive",
    });
  }, [toast]);


  // ===============================
  // 📦 Dữ liệu học sinh (React Query)
  // ===============================
  const {
    students,
    isLoading,
    refetch,
    create,
    update,
    remove,
    autoAssign,
    transfer: transferStudent,
  } = useStudents(studentsQueryParams);

  const {
    data: transferHistoryResponse,
    isLoading: isHistoryLoading,
    isFetching: isHistoryFetching,
    error: historyError,
    refetch: refetchHistory,
  } = useStudentTransferHistory(historyStudent?._id, {
    enabled: isHistoryDialogOpen && !!historyStudent?._id,
    page: 1,
    limit: 20,
  });

  // ===============================
  // ⚙️ Tải cấu hình trường học + lớp
  // ===============================
  // ✅ schoolYears đã được load từ hook useSchoolYears

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

  // ✅ Không cần fetchSchoolConfigs nữa vì đã dùng hook

  useEffect(() => {
    if (selectedYear) fetchGroupedClasses(selectedYear);
    else setGroupedClasses([]);
    setSelectedGrade("");
    setSelectedClass("");
  }, [selectedYear, fetchGroupedClasses]);
  // ✅ Set năm học hiện tại khi có dữ liệu
  useEffect(() => {
    if (currentYearCode && !selectedYear) {
      setSelectedYear(currentYearCode);
    }
  }, [currentYearCode, selectedYear]);

  useEffect(() => {
    if (!canUseStudentForm && isFormOpen) {
      setIsFormOpen(false);
      setSelectedStudent(null);
    }
  }, [canUseStudentForm, isFormOpen]);

  useEffect(() => {
    if (!isTransferDialogOpen || !transferYear) {
      if (!isTransferDialogOpen) {
        setTransferClasses([]);
        setIsLoadingTransferClasses(false);
      }
      return;
    }

    let cancelled = false;
    setIsLoadingTransferClasses(true);

    classApi
      .getGradesAndClassesByYear(transferYear)
      .then((res) => {
        if (!cancelled) {
          setTransferClasses(res || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTransferClasses([]);
          toast({
            title: "Lỗi tải lớp học",
            description: `Không thể tải danh sách lớp của năm ${transferYear}`,
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTransferClasses(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isTransferDialogOpen, transferYear, toast]);

  useEffect(() => {
    if (!isTransferDialogOpen || !transferClasses.length) {
      return;
    }

    const hasCurrentGrade = transferGrade
      ? transferClasses.some((group) => group.grade === transferGrade)
      : false;

    if (hasCurrentGrade) {
      return;
    }

    const preferredGrade = transferringStudent?.grade;
    const fallbackGrade = preferredGrade && transferClasses.some((group) => group.grade === preferredGrade)
      ? preferredGrade
      : transferClasses[0].grade;

    setTransferGrade(fallbackGrade);
  }, [isTransferDialogOpen, transferClasses, transferGrade, transferringStudent]);

  useEffect(() => {
    if (!transferClassId) {
      return;
    }

    const exists = transferClasses.some((group) =>
      group.classes.some((cls) => cls._id === transferClassId)
    );

    if (!exists) {
      setTransferClassId("");
    }
  }, [transferClasses, transferClassId]);
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

  const transferYearOptions = useMemo(() => {
    const codes = new Set(schoolYears.map((y) => y.code));
    if (transferYear && transferYear !== "" && !codes.has(transferYear)) {
      return [...schoolYears, { code: transferYear, name: transferYear }];
    }
    return schoolYears;
  }, [schoolYears, transferYear]);

  const availableTransferClasses = useMemo(() => {
    if (!transferClasses.length) {
      return [];
    }
    return transferClasses
      .filter((group) => !transferGrade || group.grade === transferGrade)
      .flatMap((group) => group.classes)
      .sort((a, b) => a.className.localeCompare(b.className, "vi", { sensitivity: "base" }));
  }, [transferClasses, transferGrade]);

  const historyItems = transferHistoryResponse?.data ?? [];
  const historyPagination = transferHistoryResponse?.pagination;

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    []
  );

  const formatDateTime = useCallback(
    (value?: string | Date | null) => {
      if (!value) {
        return "—";
      }
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "—";
      }
      return dateTimeFormatter.format(date);
    },
    [dateTimeFormatter]
  );

  const handleOpenHistory = (student: Student) => {
    setHistoryStudent(student);
    setIsHistoryDialogOpen(true);
  };

  const handleHistoryDialogChange = (open: boolean) => {
    setIsHistoryDialogOpen(open);
    if (!open) {
      setHistoryStudent(null);
    }
  };

  // ===============================
// 📊 Thống kê nhanh
// ===============================
  const totalStudents = filteredStudents.length;
  const activeCount = filteredStudents.filter((s) => s.status === "active").length;
  const inactiveCount = filteredStudents.filter((s) => s.status === "inactive").length;
  const graduatedCount = filteredStudents.filter((s) => s.status === "graduated").length;
  const classCount = new Set(filteredStudents.map((s) => s.classId?._id).filter(Boolean)).size;

  // ===============================
  // ⚙️ Auto assign
  // ===============================
  const handleAutoAssign = async () => {
    if (!canAutoAssignStudents) {
      showPermissionDeniedToast();
      return;
    }
    try {
      const currentYear = currentYearCode || "2025-2026";

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
    "Năm học hiện tại": s.currentYear || currentYearCode || "",
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
  if (!canImportStudents) {
    showPermissionDeniedToast();
    e.target.value = "";
    return;
  }
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
          currentYear: row["Năm học hiện tại"] || currentYearCode,

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
    if (!canOpenCreateForm) {
      showPermissionDeniedToast();
      return;
    }
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
    if (!canPerformEdits) {
      showPermissionDeniedToast();
      return;
    }
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
    if (!canPerformDeletes) {
      showPermissionDeniedToast();
      return;
    }
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

  const handleOpenTransfer = useCallback(
    (student: Student) => {
      if (!canTransferStudent) {
        showPermissionDeniedToast();
        return;
      }
      const defaultYear =
        student.currentYear ||
        (selectedYear && selectedYear !== "0" ? selectedYear : "") ||
        currentYearCode ||
        "";

      setTransferringStudent(student);
      setTransferYear(defaultYear);
      setTransferGrade(student.grade || "");
      setTransferClassId("");
      setTransferReason("");
      setIsTransferDialogOpen(true);
    },
    [canTransferStudent, currentYearCode, selectedYear, showPermissionDeniedToast]
  );

  const handleTransferDialogChange = (open: boolean) => {
    setIsTransferDialogOpen(open);
    if (!open) {
      setTransferringStudent(null);
      setTransferYear("");
      setTransferGrade("");
      setTransferClassId("");
      setTransferReason("");
      setTransferClasses([]);
      setIsLoadingTransferClasses(false);
      setIsSubmittingTransfer(false);
    }
  };

  const handleTransferSubmit = async () => {
    if (!canTransferStudent) {
      showPermissionDeniedToast();
      return;
    }
    if (!transferringStudent) {
      return;
    }

    if (!transferClassId) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng chọn lớp chuyển đến.",
        variant: "destructive",
      });
      return;
    }

    if (transferringStudent.classId?._id === transferClassId) {
      toast({
        title: "Lớp không thay đổi",
        description: "Học sinh đang ở lớp này, vui lòng chọn lớp khác.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingTransfer(true);

    try {
      const response = await transferStudent({
        id: transferringStudent._id,
        data: {
          targetClassId: transferClassId,
          effectiveDate: new Date().toISOString(),
          reason: transferReason.trim() ? transferReason.trim() : undefined,
        },
      });

      const targetClassName = response?.data?.toClass?.name;

      toast({
        title: "Đã chuyển lớp",
        description: `${transferringStudent.name} được chuyển sang ${targetClassName || 'lớp mới'}.`,
      });

      refetch();
      if (
        isHistoryDialogOpen &&
        historyStudent?._id === transferringStudent._id
      ) {
        refetchHistory();
      }
      handleTransferDialogChange(false);
    } catch (err: any) {
      toast({
        title: "Chuyển lớp thất bại",
        description: err?.message || "Không thể chuyển lớp cho học sinh.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingTransfer(false);
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
          {canAutoAssignStudents && (
            <Button variant="outline" onClick={handleAutoAssign}>
              <Wand2 className="h-4 w-4 mr-2" /> Phân lớp tự động
            </Button>
          )}

          {canOpenCreateForm && (
            <Button
              onClick={() => {
                setSelectedStudent(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Thêm học sinh
            </Button>
          )}

          <Button variant="outline" onClick={handleExportExcel}>📤 Xuất Excel</Button>

          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Tải mẫu Excel
          </Button>

          {canImportStudents && (
            <div>
              <input
                type="file"
                accept=".xlsx,.xls"
                id="importExcel"
                style={{ display: "none" }}
                onChange={handleImportExcel}
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("importExcel")?.click()}
              >
                📥 Nhập Excel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="flex items-center gap-3 py-3"><Users className="h-6 w-6 text-primary" /><div><p className="text-sm text-muted-foreground">Tổng học sinh</p><p className="text-2xl font-semibold">{totalStudents}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-3"><BookOpen className="h-6 w-6 text-green-600" /><div><p className="text-sm text-muted-foreground">Đang học</p><p className="text-2xl font-semibold">{activeCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-3"><PieChart className="h-6 w-6 text-gray-500" /><div><p className="text-sm text-muted-foreground">Ngưng học</p><p className="text-2xl font-semibold">{inactiveCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-3"><School className="h-6 w-6 text-purple-600" /><div><p className="text-sm text-muted-foreground">Đã tốt nghiệp</p><p className="text-2xl font-semibold">{graduatedCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-3"><School className="h-6 w-6 text-blue-600" /><div><p className="text-sm text-muted-foreground">Số lớp</p><p className="text-2xl font-semibold">{classCount}</p></div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Input placeholder="🔍 Tìm kiếm theo tên, mã, email..." onChange={(e) => debouncedSearch(e.target.value)} className="flex-1 min-w-[220px]" />

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Chọn năm học" /></SelectTrigger>
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
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Tất cả</SelectItem>
              <SelectItem value="active">Đang học</SelectItem>
              <SelectItem value="inactive">Ngưng học</SelectItem>
              <SelectItem value="graduated">Đã tốt nghiệp</SelectItem>
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
  {s.status === "graduated" && (
    <Badge className="ml-2 bg-purple-200 text-purple-700">Đã tốt nghiệp</Badge>
  )}
</div>

                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => viewDetail(s)}><Eye className="h-4 w-4" /></Button>
                  {canTransferStudent && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenTransfer(s)}
                      title="Chuyển lớp"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenHistory(s)}
                    title="Lịch sử chuyển lớp"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  {canPerformEdits && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedStudent(s);
                        setIsFormOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {canPerformDeletes && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {
                        setDeletingStudent(s);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
      <Dialog open={isTransferDialogOpen} onOpenChange={handleTransferDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chuyển lớp học sinh</DialogTitle>
            <DialogDescription>
              Chọn lớp mới cho học sinh. Sĩ số lớp, bảng điểm và thống kê sẽ được cập nhật tự động.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted/60 p-3 text-sm space-y-1">
              <p>
                <span className="font-medium">Học sinh:</span>{" "}
                {transferringStudent ? `${transferringStudent.name} (${transferringStudent.studentCode || '—'})` : '—'}
              </p>
              <p>
                <span className="font-medium">Lớp hiện tại:</span>{" "}
                {transferringStudent?.classId?.className || 'Chưa phân lớp'}
              </p>
              <p>
                <span className="font-medium">Năm học hiện tại:</span>{" "}
                {transferringStudent?.currentYear || '—'}
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Năm học</span>
                <Select
                  value={transferYear}
                  onValueChange={(value) => {
                    setTransferYear(value);
                    setTransferGrade("");
                    setTransferClassId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn năm học" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferYearOptions.map((year) => (
                      <SelectItem key={year.code} value={year.code}>
                        {year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Khối</span>
                <Select
                  value={transferGrade}
                  onValueChange={(value) => {
                    setTransferGrade(value);
                    setTransferClassId("");
                  }}
                  disabled={!transferClasses.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn khối" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferClasses.map((group) => (
                      <SelectItem key={group.grade} value={group.grade}>
                        Khối {group.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Lớp chuyển đến</span>
                {isLoadingTransferClasses ? (
                  <p className="text-sm text-muted-foreground">Đang tải danh sách lớp...</p>
                ) : (
                  <Select
                    value={transferClassId}
                    onValueChange={(value) => {
                      setTransferClassId(value);
                      const group = transferClasses.find((g) =>
                        g.classes.some((cls) => cls._id === value)
                      );
                      if (group) {
                        setTransferGrade(group.grade);
                      }
                    }}
                    disabled={!availableTransferClasses.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn lớp" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTransferClasses.map((cls) => {
                        const isSameClass = cls._id === transferringStudent?.classId?._id;
                        const isFull =
                          typeof cls.capacity === 'number' &&
                          typeof cls.currentSize === 'number' &&
                          cls.capacity > 0 &&
                          cls.currentSize >= cls.capacity;
                        const meta: string[] = [];
                        if (cls.grade) meta.push(`Khối ${cls.grade}`);
                        if (typeof cls.capacity === 'number' && typeof cls.currentSize === 'number') {
                          meta.push(`${cls.currentSize}/${cls.capacity} HS`);
                        }
                        if (isSameClass) meta.push('Lớp hiện tại');
                        if (isFull && !isSameClass) meta.push('Đã đủ sĩ số');
                        const label = meta.length ? `${cls.className} • ${meta.join(' • ')}` : cls.className;

                        return (
                          <SelectItem
                            key={cls._id}
                            value={cls._id}
                            disabled={isSameClass || isFull}
                          >
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
                {!isLoadingTransferClasses && !availableTransferClasses.length && (
                  <p className="text-xs text-muted-foreground">Không tìm thấy lớp phù hợp trong năm học đã chọn.</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Lý do chuyển lớp (tuỳ chọn)</span>
                <Textarea
                  placeholder="Nhập lý do chuyển lớp"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Sau khi xác nhận, học sinh sẽ được cập nhật sang lớp mới cùng bảng điểm và lịch sử liên quan.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleTransferDialogChange(false)}
              disabled={isSubmittingTransfer}
            >
              Huỷ
            </Button>
            <Button
              onClick={handleTransferSubmit}
              disabled={isSubmittingTransfer || !transferClassId}
            >
              {isSubmittingTransfer && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Xác nhận chuyển
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={handleHistoryDialogChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lịch sử chuyển lớp</DialogTitle>
            <DialogDescription>
              {historyStudent
                ? `Các lần chuyển lớp của ${historyStudent.name} (${historyStudent.studentCode || "không có mã"}).`
                : "Theo dõi các lần chuyển lớp của học sinh."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {isHistoryLoading || isHistoryFetching ? (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải lịch sử chuyển lớp...
              </div>
            ) : historyError ? (
              <p className="text-sm text-destructive">
                Không thể tải lịch sử chuyển lớp. Vui lòng thử lại.
              </p>
            ) : historyItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có lần chuyển lớp nào được ghi nhận.
              </p>
            ) : (
              historyItems.map((entry) => {
                const performer = entry.performedBy;
                const performerLabel = performer?.name || performer?.email || "Không rõ";
                const performerRole = performer?.role ? performer.role.toUpperCase() : null;
                const keepOldRecords = entry.metadata?.keepOldYearRecords !== false;

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border bg-muted/40 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                      <span>
                        {(entry.fromClassName ?? "Chưa phân lớp")} → {entry.toClassName ?? "Không xác định"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Hiệu lực: {formatDateTime(entry.effectiveDate)}
                      </span>
                    </div>

                    <div className="text-sm leading-snug">
                      <span className="font-medium">Lý do:</span>{" "}
                      {entry.reason && entry.reason.trim()
                        ? entry.reason
                        : "Không cung cấp"}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        Thực hiện: {performerLabel}
                        {performerRole ? ` (${performerRole})` : ""}
                      </div>
                      <div>Ghi nhận: {formatDateTime(entry.createdAt)}</div>
                      <div>
                        Giữ bảng điểm cũ: {keepOldRecords ? "Có" : "Không"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {historyPagination && historyPagination.total > 0 && (
            <p className="text-xs text-muted-foreground">
              Hiển thị {historyItems.length} / {historyPagination.total} lần chuyển lớp gần nhất.
            </p>
          )}
        </DialogContent>
      </Dialog>
      {canUseStudentForm && (
        <StudentForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          studentData={
            selectedStudent
              ? { ...selectedStudent, classId: selectedStudent.classId?._id ?? null }
              : undefined
          }
          onSubmit={selectedStudent ? handleEdit : handleCreate}
        />
      )}

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

import { useEffect, useState, useMemo } from "react";
import { Department, DepartmentInput } from "@/types/department";
import { Teacher } from "@/types/auth";
import { Subject } from "@/types/class";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useTeachers, useSubjects, useDepartments, useDepartmentTeachers } from "@/hooks";
import { getTeacherDepartmentId, getTeacherDepartmentName } from '@/utils/teacher';
import useCurrentAcademicYear from '@/hooks/useCurrentAcademicYear';
import { departmentApi } from "@/services/departmentApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Users, Search, Eye, BookOpen, User, UserCheck, ChevronRight, UserPlus, UserMinus, Copy, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DepartmentsList = () => {
  // ✅ Sử dụng hooks
  const { departments, isLoading: loading, create: createDepartment, update: updateDepartment, remove: removeDepartment, refetch: refetchDepartments } = useDepartments();
  const { teachers } = useTeachers();
  const { subjects } = useSubjects();
  const { schoolYears, currentYearCode, currentYearData } = useCurrentAcademicYear();
  // SelectItem values use `year.name`, so prefer `currentYearData.name` to match those values.
  const defaultYearName = currentYearData?.name || currentYearCode || null;
  const [selectedListYear, setSelectedListYear] = useState<string>(defaultYearName || "ALL");
  const [selectedViewYear, setSelectedViewYear] = useState<string>(defaultYearName || "");
  // Prefer working with the year code for year-scoped lookups (e.g., yearRoles.schoolYear)
  const activeYearCode = currentYearData?.code || currentYearCode;
  const getYearCodeFromName = (name?: string) => {
    if (!name) return undefined;
    const found = schoolYears?.find((y: any) => y.name === name);
    return found?.code || name;
  };
  const selectedViewYearCode = getYearCodeFromName(selectedViewYear) || activeYearCode;
  const [departmentTeachers, setDepartmentTeachers] = useState<Teacher[]>([]);
  const [loadingDepartmentTeachers, setLoadingDepartmentTeachers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [viewingDepartment, setViewingDepartment] = useState<Department | null>(null);
  const [isAddTeacherDialogOpen, setIsAddTeacherDialogOpen] = useState(false);
  const [selectedTeachersToAdd, setSelectedTeachersToAdd] = useState<string[]>([]);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copyFromYear, setCopyFromYear] = useState<string>("");
  const [copyToYear, setCopyToYear] = useState<string>("");
  const [copyLoading, setCopyLoading] = useState(false);
  // whether the selected view-year corresponds to the active school year
  const isSelectedViewYearActive = Boolean(
    selectedViewYear &&
      schoolYears?.find((y: any) => y.name === selectedViewYear)?.isActive
  );
  
  // ✅ Hook để quản lý giáo viên trong tổ
  const { addTeacher: addTeacherToDepartment, removeTeacher: removeTeacherFromDepartment } = useDepartmentTeachers(viewingDepartment?._id);

  // Form state
  const [formData, setFormData] = useState<DepartmentInput>({
    name: "",
    code: "",
    description: "",
    headTeacherId: null,
    subjectIds: [],
    notes: "",
    year: currentYearCode || "",
    status: "active",
  });

  const { toast } = useToast();

  // ✅ Không cần loadDepartments nữa vì đã dùng hooks

  const filteredDepartments = useMemo(() => {
    return departments
      .filter((d) => {
        // if a list year is selected (and not the ALL sentinel), filter departments by their year or schoolYear
        if (selectedListYear && selectedListYear !== "ALL") {
          const deptYear = (d as any).year || (d as any).schoolYear || "";
          if (String(deptYear) !== String(selectedListYear)) return false;
        }
        return (
          d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.code?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      })
      ;
  }, [departments, searchTerm, selectedListYear]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      headTeacherId: null,
      subjectIds: [],
      notes: "",
      year: currentYearCode || "",
      status: "active",
    });
    setEditingDepartment(null);
  };

  // Lấy năm học hiện tại khi component mount
  useEffect(() => {
    const yearToUse = currentYearData?.name || currentYearCode || null;
    if (yearToUse && !formData.year) {
      setFormData(prev => ({ ...prev, year: yearToUse }));
    }
    // When currentYear becomes available, prefer it as the default selection
    // if the list/view year hasn't been chosen yet (still unset or using the ALL sentinel).
    if (yearToUse && (selectedListYear === "" || selectedListYear === "ALL")) {
      setSelectedListYear(yearToUse);
    }
    if (yearToUse && (selectedViewYear === "" || selectedViewYear === "ALL")) {
      setSelectedViewYear(yearToUse);
    }
  }, [currentYearCode]);

  // Debounce search input to avoid frequent re-renders while typing
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Handle add/edit
  const handleSubmit = async () => {
    try {
      if (editingDepartment) {
        await updateDepartment({ id: editingDepartment._id, data: formData });
        toast({ title: "Thành công", description: "Đã cập nhật tổ bộ môn" });
      } else {
        await createDepartment(formData);
        toast({ title: "Thành công", description: "Đã thêm tổ bộ môn" });
      }
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Thao tác thất bại",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      code: department.code || "",
      description: department.description || "",
      headTeacherId:
        typeof department.headTeacherId === "object" && department.headTeacherId?._id
          ? department.headTeacherId._id
          : typeof department.headTeacherId === "string"
          ? department.headTeacherId
          : null,
      subjectIds:
        department.subjectIds?.map((s) =>
          typeof s === "object" ? s._id : s
        ) || [],
      notes: department.notes || "",
      year: (department as any).year || currentYearCode || "",
      status: department.status || "active",
    });
    setIsAddDialogOpen(true);
  };

  // Xử lý sao chép tổ bộ môn từ năm học khác
  const handleCopyFromYear = async () => {
    if (!copyFromYear || !copyToYear) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn năm học nguồn và năm học đích",
        variant: "destructive",
      });
      return;
    }

    if (copyFromYear === copyToYear) {
      toast({
        title: "Lỗi",
        description: "Năm học nguồn và năm học đích không được giống nhau",
        variant: "destructive",
      });
      return;
    }

    try {
      setCopyLoading(true);
      const result = await departmentApi.copyFromYear(copyFromYear, copyToYear);
      
      toast({
        title: "Thành công",
        description: result.message,
      });

      if (result.errors && result.errors.length > 0) {
        console.warn("Một số tổ bộ môn không thể sao chép:", result.errors);
      }

      setIsCopyDialogOpen(false);
      setCopyFromYear("");
      setCopyToYear("");
      refetchDepartments();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể sao chép tổ bộ môn",
        variant: "destructive",
      });
    } finally {
      setCopyLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDepartment) return;
    try {
      await removeDepartment(deletingDepartment._id);
      toast({ title: "Thành công", description: "Đã xóa tổ bộ môn" });
      setDeletingDepartment(null);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Xóa thất bại",
        variant: "destructive",
      });
    }
  };

  const getHeadTeacherName = (headTeacherId: any) => {
    if (!headTeacherId) return "-";
    const teacherId =
      typeof headTeacherId === "object" ? headTeacherId._id : headTeacherId;
    const teacher = teachers.find((t) => t._id === teacherId);
    return teacher?.name || "-";
  };

  // Resolve a teacher's role for a specific school year (prefers yearRoles array)
  const getYearRole = (teacher: Teacher | any, yearCode?: string | null) => {
    if (!teacher) return null;
    // if departmentApi.getTeachers returned a single yearRole, prefer it
    if ((teacher as any).yearRole) return (teacher as any).yearRole;
    const yearRoles = (teacher as any).yearRoles || [];
    if (!yearRoles || yearRoles.length === 0) return null;
    if (!yearCode) return null;
    return yearRoles.find((r: any) => String(r.schoolYear) === String(yearCode)) || null;
  };

  const getSubjectNames = (subjectIds: any[]) => {
    if (!subjectIds || subjectIds.length === 0) return "Chưa có môn học";
    return subjectIds
      .map((id) => {
        const subjectId = typeof id === "object" ? id._id : id;
        const subject = subjects.find((s) => s._id === subjectId);
        return subject?.name;
      })
      .filter(Boolean)
      .join(", ");
  };

  // Lấy danh sách giáo viên trong tổ (ưu tiên dữ liệu theo năm khi có)
  const getDepartmentTeachers = (departmentId: string) => {
    // Khi đang xem chi tiết 1 tổ (viewingDepartment), ưu tiên dữ liệu theo năm (departmentTeachers)
    if (viewingDepartment && departmentTeachers && viewingDepartment._id === departmentId) {
      return departmentTeachers;
    }

    return teachers.filter((teacher) => {
      const teacherDeptId = getTeacherDepartmentId(teacher, selectedViewYearCode || activeYearCode);
      return teacherDeptId === departmentId;
    });
  };

  // Fetch department teachers for a given viewing department and year
  const fetchDepartmentTeachers = async (deptId?: string, year?: string) => {
    if (!deptId) return;
    setLoadingDepartmentTeachers(true);
    try {
      const data = await departmentApi.getTeachers(deptId, year ? { year } : undefined);
      setDepartmentTeachers(data || []);
    } catch (err) {
      console.error("Failed fetching department teachers:", err);
      setDepartmentTeachers([]);
    } finally {
      setLoadingDepartmentTeachers(false);
    }
  };

  // When opening detail view, set selected year and fetch teachers
  useEffect(() => {
    if (viewingDepartment) {
      const initialYear = (viewingDepartment as any).year || currentYearCode || "";
      setSelectedViewYear(initialYear);
      fetchDepartmentTeachers(viewingDepartment._id, initialYear);
    } else {
      setDepartmentTeachers([]);
    }
  }, [viewingDepartment, currentYearCode]);

  // Lấy số lượng thành viên trong tổ
  const getMemberCount = (departmentId: string) => {
    const members = getDepartmentTeachers(departmentId) || [];
    // include head teacher as a member if not already included
    const dept = departments.find((d) => d._id === departmentId);
    const headTeacherId = dept
      ? typeof (dept as any).headTeacherId === "object" && (dept as any).headTeacherId !== null
        ? (dept as any).headTeacherId._id
        : (dept as any).headTeacherId
      : null;
    const headIncluded = headTeacherId ? members.some((m) => m._id === headTeacherId) : false;
    return members.length + (headTeacherId && !headIncluded ? 1 : 0);
  };

  // Lấy danh sách giáo viên chưa thuộc tổ nào và dạy ít nhất một môn trong tổ
  // Trả về kèm thông tin về các môn học chung
  const getAvailableTeachers = (departmentId: string) => {
    const department = departments.find(d => d._id === departmentId);
    if (!department || !department.subjectIds || department.subjectIds.length === 0) {
      return []; // Nếu tổ chưa có môn học, không có giáo viên nào phù hợp
    }

    // Lấy danh sách môn học của tổ
    const departmentSubjectIds = department.subjectIds.map((s: any) => 
      typeof s === 'object' ? s._id : s
    );

    // ✅ Lấy năm học đang xem (code) để kiểm tra chính xác
    const viewYearCode = selectedViewYearCode || activeYearCode;
    
    return teachers
      .map((teacher) => {
        // 1. ✅ Kiểm tra giáo viên chưa thuộc tổ nào TRONG NĂM HỌC ĐANG XEM
        // Chỉ kiểm tra yearRoles cho năm học đang xem, không fallback về legacy departmentId
        let teacherDeptIdInYear: string | null = null;
        if (viewYearCode && Array.isArray(teacher.yearRoles)) {
          const yearRole = teacher.yearRoles.find((r: any) => String(r.schoolYear) === String(viewYearCode));
          if (yearRole && yearRole.departmentId) {
            teacherDeptIdInYear = typeof yearRole.departmentId === 'object' && yearRole.departmentId !== null 
              ? (yearRole.departmentId._id || yearRole.departmentId) 
              : yearRole.departmentId;
          }
        }
        
        // ✅ Nếu giáo viên đã thuộc tổ nào đó trong năm học đang xem, bỏ qua
        if (teacherDeptIdInYear) return null;

        // 2. Giáo viên phải dạy ít nhất một môn trong danh sách môn của tổ
        // Prefer year-scoped subjects (in yearRole) then fallback to top-level subjects
        const yearRole = getYearRole(teacher, selectedViewYearCode || activeYearCode);
        const teacherSubjects = (yearRole && yearRole.subjects && yearRole.subjects.length > 0)
          ? yearRole.subjects
          : teacher.subjects || [];

        if (!teacherSubjects || teacherSubjects.length === 0) return null;

        // ✅ Tìm các môn học chung giữa giáo viên và tổ
        const commonSubjects = teacherSubjects
          .map((sub: any) => {
            const subjectId = typeof sub.subjectId === 'object' && sub.subjectId !== null
              ? sub.subjectId._id
              : sub.subjectId;
            return departmentSubjectIds.includes(subjectId) ? subjectId : null;
          })
          .filter(Boolean);

        // Chỉ trả về giáo viên có ít nhất một môn học chung
        if (commonSubjects.length === 0) return null;

        return {
          ...teacher,
          commonSubjectIds: commonSubjects, // ✅ Thêm thông tin môn học chung
        };
      })
      .filter(Boolean) as (Teacher & { commonSubjectIds: string[] })[];
  };

  // Thêm giáo viên vào tổ (hỗ trợ nhiều giáo viên)
  const handleAddTeachers = async () => {
    if (!viewingDepartment || selectedTeachersToAdd.length === 0) return;

    try {
      // ✅ Thêm từng giáo viên
      const results = await Promise.allSettled(
        selectedTeachersToAdd.map(teacherId => addTeacherToDepartment(teacherId))
      );
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      
      if (successCount > 0) {
        toast({
          title: "Thành công",
          description: `Đã thêm ${successCount} giáo viên vào tổ bộ môn${failCount > 0 ? ` (${failCount} giáo viên thất bại)` : ''}`,
        });
      } else {
        toast({
          title: "Lỗi",
          description: "Không thể thêm giáo viên vào tổ",
          variant: "destructive",
        });
      }
      
      setSelectedTeachersToAdd([]);
      setIsAddTeacherDialogOpen(false);
      // ✅ Refresh department teachers sau khi thêm, sử dụng năm học đang xem (code)
      fetchDepartmentTeachers(viewingDepartment._id, selectedViewYearCode || activeYearCode);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể thêm giáo viên vào tổ",
        variant: "destructive",
      });
    }
  };

  // Xóa giáo viên khỏi tổ
  const handleRemoveTeacher = async (teacherId: string) => {
    if (!viewingDepartment) return;

    if (!window.confirm("Bạn có chắc chắn muốn xóa giáo viên này khỏi tổ bộ môn?")) {
      return;
    }

    try {
      await removeTeacherFromDepartment(teacherId);
      toast({
        title: "Thành công",
        description: "Đã xóa giáo viên khỏi tổ bộ môn",
      });
      // refresh department teachers after removal
      fetchDepartmentTeachers(viewingDepartment._id, selectedViewYear);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể xóa giáo viên khỏi tổ",
        variant: "destructive",
      });
    }
  };

  // Lọc giáo viên theo môn học đã chọn
  const getFilteredTeachers = () => {
    if (!formData.subjectIds || formData.subjectIds.length === 0) {
      return teachers; // Nếu chưa chọn môn nào, hiển thị tất cả
    }

    return teachers.filter((teacher) => {
      // Kiểm tra xem giáo viên có dạy ít nhất một môn trong danh sách đã chọn không
      const yearRole = getYearRole(teacher, formData.year || selectedViewYearCode || activeYearCode);
      const teacherSubjects = (yearRole && yearRole.subjects && yearRole.subjects.length > 0)
        ? yearRole.subjects
        : teacher.subjects || [];

      if (!teacherSubjects || teacherSubjects.length === 0) return false;

      return teacherSubjects.some((sub: any) => {
        const subjectId = typeof sub.subjectId === 'object' 
          ? sub.subjectId?._id 
          : sub.subjectId;
        return formData.subjectIds?.includes(subjectId);
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quản lý tổ bộ môn</h1>
          <p className="text-muted-foreground">
            Quản lý các tổ chuyên môn trong trường
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Tạo tổ bộ môn
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingDepartment ? "Chỉnh sửa tổ bộ môn" : "Thêm tổ bộ môn mới"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {editingDepartment ? "Cập nhật thông tin tổ bộ môn" : "Tạo tổ bộ môn mới trong hệ thống"}
                </p>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="year">Năm học *</Label>
                  <Select
                    value={formData.year || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, year: value })
                    }
                  >
                    <SelectTrigger id="year">
                      <SelectValue placeholder="Chọn năm học" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolYears
                        .filter((year) => year.name && year.name.trim() !== "")
                        .sort((a, b) => {
                          // ✅ Ưu tiên năm học hiện tại (isActive: true) lên đầu
                          if (a.isActive && !b.isActive) return -1;
                          if (!a.isActive && b.isActive) return 1;
                          return 0;
                        })
                        .map((year) => (
                          <SelectItem key={year._id} value={year.name}>
                            {year.name} {year.isActive && "(Hiện tại)"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="name">Tên tổ bộ môn *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ví dụ: Tổ Toán, Tổ Văn"
                />
              </div>
              <div>
                <Label htmlFor="code">Mã tổ bộ môn</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="Ví dụ: TOAN, VAN (để trống sẽ tự động tạo)"
                />
              </div>
              <div>
                <Label htmlFor="description">Mô tả</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Mô tả về tổ bộ môn"
                />
              </div>
              <div>
                <Label htmlFor="headTeacherId">Trưởng bộ môn</Label>
                <Select
                  value={formData.headTeacherId || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      headTeacherId: value === "none" ? null : value,
                    })
                  }
                  disabled={!formData.subjectIds || formData.subjectIds.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      formData.subjectIds && formData.subjectIds.length > 0
                        ? "Chọn trưởng bộ môn"
                        : "Vui lòng chọn môn học trước"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không có</SelectItem>
                    {getFilteredTeachers().map((teacher) => (
                      <SelectItem key={teacher._id} value={teacher._id}>
                        {teacher.name} ({teacher.teacherCode})
                        {teacher.subjects && teacher.subjects.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            - {teacher.subjects
                              .map((sub) => {
                                const subjectId = typeof sub.subjectId === 'object' 
                                  ? sub.subjectId?._id 
                                  : sub.subjectId;
                                const subject = subjects.find(s => s._id === subjectId);
                                return subject?.name;
                              })
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!formData.subjectIds || formData.subjectIds.length === 0) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vui lòng chọn môn học trước để hiển thị danh sách giáo viên phù hợp
                  </p>
                )}
                {formData.subjectIds && formData.subjectIds.length > 0 && getFilteredTeachers().length === 0 && (
                  <p className="text-xs text-warning mt-1">
                    Không có giáo viên nào dạy các môn đã chọn
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="subjectIds">Môn học thuộc tổ</Label>
                <Select
                  value="select-subject"
                  onValueChange={(value) => {
                    if (value && value !== "select-subject" && !formData.subjectIds?.includes(value)) {
                      const newSubjectIds = [...(formData.subjectIds || []), value];
                      
                      // Kiểm tra xem trưởng bộ môn hiện tại có còn phù hợp không
                      let newHeadTeacherId = formData.headTeacherId;
                      if (formData.headTeacherId && formData.headTeacherId !== "none") {
                        const currentTeacher = teachers.find(t => t._id === formData.headTeacherId);
                        if (currentTeacher) {
                          const teacherTeachesSelectedSubjects = currentTeacher.subjects?.some((sub) => {
                            const subjectId = typeof sub.subjectId === 'object' 
                              ? sub.subjectId?._id 
                              : sub.subjectId;
                            return newSubjectIds.includes(subjectId);
                          });
                          
                          // Nếu giáo viên hiện tại không dạy môn nào trong danh sách mới, reset về null
                          if (!teacherTeachesSelectedSubjects) {
                            newHeadTeacherId = null;
                          }
                        }
                      }
                      
                      setFormData({
                        ...formData,
                        subjectIds: newSubjectIds,
                        headTeacherId: newHeadTeacherId,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn môn học để thêm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select-subject" disabled>Chọn môn học để thêm</SelectItem>
                    {subjects
                      .filter(
                        (s) => !formData.subjectIds?.includes(s._id)
                      )
                      .map((subject) => (
                        <SelectItem key={subject._id} value={subject._id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formData.subjectIds && formData.subjectIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.subjectIds.map((subjectId) => {
                      const subject = subjects.find((s) => s._id === subjectId);
                      return subject ? (
                        <Badge
                          key={subjectId}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => {
                            const newSubjectIds = formData.subjectIds?.filter(
                              (id) => id !== subjectId
                            ) || [];
                            
                            // Kiểm tra xem trưởng bộ môn hiện tại có còn phù hợp không
                            let newHeadTeacherId = formData.headTeacherId;
                            if (formData.headTeacherId && formData.headTeacherId !== "none" && newSubjectIds.length > 0) {
                              const currentTeacher = teachers.find(t => t._id === formData.headTeacherId);
                              if (currentTeacher) {
                                const teacherTeachesRemainingSubjects = currentTeacher.subjects?.some((sub) => {
                                  const subId = typeof sub.subjectId === 'object' 
                                    ? sub.subjectId?._id 
                                    : sub.subjectId;
                                  return newSubjectIds.includes(subId);
                                });
                                
                                // Nếu giáo viên hiện tại không dạy môn nào còn lại, reset về null
                                if (!teacherTeachesRemainingSubjects) {
                                  newHeadTeacherId = null;
                                }
                              }
                            } else if (newSubjectIds.length === 0) {
                              // Nếu xóa hết môn học, reset trưởng bộ môn
                              newHeadTeacherId = null;
                            }
                            
                            setFormData({
                              ...formData,
                              subjectIds: newSubjectIds,
                              headTeacherId: newHeadTeacherId,
                            });
                          }}
                        >
                          {subject.name} ×
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="notes">Ghi chú</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Ghi chú bổ sung"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                >
                  Hủy
                </Button>
                <Button onClick={handleSubmit}>
                  {editingDepartment ? "Cập nhật" : "Thêm"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Copy className="mr-2 h-4 w-4" /> Sao chép từ năm học
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sao chép tổ bộ môn từ năm học</DialogTitle>
              <DialogDescription>
                Sao chép tất cả tổ bộ môn từ năm học nguồn sang năm học đích. Chỉ sao chép thông tin tổ bộ môn, không sao chép trưởng bộ môn và danh sách giáo viên.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="copy-from-year">Năm học nguồn *</Label>
                <Select value={copyFromYear} onValueChange={setCopyFromYear}>
                  <SelectTrigger id="copy-from-year" className="mt-1">
                    <SelectValue placeholder="Chọn năm học nguồn" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolYears
                      .filter((year) => year.name && year.name.trim() !== "")
                      .sort((a, b) => {
                        // ✅ Ưu tiên năm học hiện tại (isActive: true) lên đầu
                        if (a.isActive && !b.isActive) return -1;
                        if (!a.isActive && b.isActive) return 1;
                        return 0;
                      })
                      .map((year) => (
                        <SelectItem key={year._id} value={year.name}>
                          {year.name} {year.isActive && "(Hiện tại)"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="copy-to-year">Năm học đích *</Label>
                <Select value={copyToYear} onValueChange={setCopyToYear}>
                  <SelectTrigger id="copy-to-year" className="mt-1">
                    <SelectValue placeholder="Chọn năm học đích" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolYears
                      .filter((year) => year.name && year.name.trim() !== "")
                      .sort((a, b) => {
                        // ✅ Ưu tiên năm học hiện tại (isActive: true) lên đầu
                        if (a.isActive && !b.isActive) return -1;
                        if (!a.isActive && b.isActive) return 1;
                        return 0;
                      })
                      .map((year) => (
                        <SelectItem key={year._id} value={year.name}>
                          {year.name} {year.isActive && "(Hiện tại)"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {copyFromYear && copyToYear && copyFromYear !== copyToYear && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Lưu ý:</strong> Sẽ sao chép tất cả tổ bộ môn từ năm học <strong>{copyFromYear}</strong> sang năm học <strong>{copyToYear}</strong>.
                    Các tổ đã tồn tại trong năm học đích sẽ được bỏ qua.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCopyDialogOpen(false)} disabled={copyLoading}>
                Hủy
              </Button>
              <Button onClick={handleCopyFromYear} disabled={copyLoading || !copyFromYear || !copyToYear || copyFromYear === copyToYear}>
                {copyLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang sao chép...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Sao chép
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col items-start gap-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Danh sách tổ bộ môn
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm tổ bộ môn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72"
              />
            </div>
            <div className="ml-3">
              {/* <Label className="text-sm">Năm học</Label> */}
              <Select value={selectedListYear} onValueChange={(v) => setSelectedListYear(v)}>
                <SelectTrigger className="min-w-[180px]">
                  <SelectValue placeholder="Tất cả năm học" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả năm học</SelectItem>
                  {schoolYears
                    .filter((y) => y.name && y.name.trim() !== "")
                    .sort((a, b) => (a.isActive && !b.isActive ? -1 : !a.isActive && b.isActive ? 1 : 0))
                    .map((year) => (
                      <SelectItem key={year._id} value={year.name}>
                        {year.name} {year.isActive && "(Hiện tại)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Đang tải danh sách tổ bộ môn...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã tổ</TableHead>
                  <TableHead>Tên tổ bộ môn</TableHead>
                  <TableHead>Trưởng bộ môn</TableHead>
                  <TableHead>Thành viên</TableHead>
                  <TableHead>Môn học</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Không tìm thấy tổ bộ môn nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDepartments.map((department) => {
                    const members = getDepartmentTeachers(department._id);
                    const memberCount = members.length;
                    const headTeacherId = typeof department.headTeacherId === 'object' && department.headTeacherId !== null
                      ? department.headTeacherId._id
                      : department.headTeacherId;
                    const headTeacher = headTeacherId ? teachers.find(t => t._id === headTeacherId) : null;
                    
                    return (
                      <TableRow key={department._id}>
                        <TableCell className="font-mono">{department.code || "-"}</TableCell>
                        <TableCell className="font-medium">{department.name}</TableCell>
                        <TableCell>
                          {headTeacher ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-xs">
                                <UserCheck className="h-3 w-3 mr-1" />
                                {headTeacher.name}
                              </Badge>
                              {headTeacher.teacherCode && (
                                <span className="text-xs text-muted-foreground">
                                  ({headTeacher.teacherCode})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Chưa có</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {memberCount} thành viên
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingDepartment(department)}
                              className="h-6 px-2 text-xs"
                              title="Xem thành viên"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Xem
                            </Button>
                            {/* Removed external "Thêm" button — use dialog's Add button instead */}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate" title={getSubjectNames(department.subjectIds || [])}>
                            {getSubjectNames(department.subjectIds || [])}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              department.status === "active" ? "default" : "secondary"
                            }
                          >
                            {department.status === "active" ? "Hoạt động" : "Tạm dừng"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(department)}
                              title="Chỉnh sửa"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingDepartment(department)}
                              title="Xóa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={!!deletingDepartment}
        onOpenChange={() => setDeletingDepartment(null)}
        onConfirm={handleDelete}
        title="Xóa tổ bộ môn"
        description={`Bạn có chắc chắn muốn xóa tổ bộ môn "${deletingDepartment?.name}"?`}
      />

      {/* Dialog xem chi tiết thành viên */}
      <Dialog
        open={!!viewingDepartment}
        onOpenChange={(open) => !open && setViewingDepartment(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Thành viên tổ bộ môn: {viewingDepartment?.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Danh sách giáo viên thuộc tổ bộ môn này
            </p>
          </DialogHeader>
          {viewingDepartment && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div>
                  <Label>Năm học</Label>
                  <Select
                    value={selectedViewYear}
                    disabled={isSelectedViewYearActive}
                    onValueChange={(value) => {
                      // if the current selection is the active year, prevent changing
                      if (isSelectedViewYearActive) return;
                      setSelectedViewYear(value);
                      fetchDepartmentTeachers(viewingDepartment._id, value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn năm học" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolYears
                        .filter((year) => year.name && year.name.trim() !== "")
                        .sort((a, b) => {
                          if (a.isActive && !b.isActive) return -1;
                          if (!a.isActive && b.isActive) return 1;
                          return 0;
                        })
                        .map((year) => (
                          <SelectItem key={year._id} value={year.name}>
                            {year.name} {year.isActive && "(Hiện tại)"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Trưởng bộ môn */}
              {(() => {
                const headTeacherId = typeof viewingDepartment.headTeacherId === 'object' && viewingDepartment.headTeacherId !== null
                  ? viewingDepartment.headTeacherId._id
                  : viewingDepartment.headTeacherId;
                const headTeacher = headTeacherId ? teachers.find(t => t._id === headTeacherId) : null;
                // prefer departmentTeachers response yearRole if available, otherwise resolve by year
                const headDeptTeacher = headTeacherId ? departmentTeachers.find(t => t._id === headTeacherId) as any : null;
                const headYearRole = headDeptTeacher?.yearRole || getYearRole(headTeacher, selectedViewYearCode || activeYearCode);
                return headTeacher ? (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="default">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Trưởng bộ môn
                          </Badge>
                          <span className="font-medium">{headTeacher.name}</span>
                          {headTeacher.teacherCode && (
                            <span className="text-sm text-muted-foreground">
                              ({headTeacher.teacherCode})
                            </span>
                          )}
                        </div>
                        {headTeacher.phone && (
                          <p className="text-sm text-muted-foreground">
                            SĐT: {headTeacher.phone}
                          </p>
                        )}
                        {headTeacher.accountId?.email && (
                          <p className="text-sm text-muted-foreground">
                            Email: {headTeacher.accountId.email}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {(headYearRole?.isHomeroom ?? headTeacher?.isHomeroom) && (
                          <Badge variant="outline" className="text-xs">GVCN</Badge>
                        )}
                        {(headYearRole?.isDepartmentHead ?? headTeacher?.isDepartmentHead) && (
                          <Badge variant="outline" className="text-xs">TBM</Badge>
                        )}
                        {(headYearRole?.isLeader ?? headTeacher?.isLeader) && (
                          <Badge variant="outline" className="text-xs">BGH</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Danh sách thành viên */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">
                    Thành viên ({getMemberCount(viewingDepartment._id)})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddTeacherDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Thêm giáo viên
                  </Button>
                </div>
                {getDepartmentTeachers(viewingDepartment._id).length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Chưa có thành viên nào trong tổ
                  </p>
                ) : (
                  <div className="space-y-2">
                    {getDepartmentTeachers(viewingDepartment._id).map((teacher) => {
                      const isHead = (typeof viewingDepartment.headTeacherId === 'object' && viewingDepartment.headTeacherId !== null
                        ? viewingDepartment.headTeacherId._id
                        : viewingDepartment.headTeacherId) === teacher._id;
                      
                      if (isHead) return null; // Đã hiển thị ở trên
                      
                      return (
                        <div
                          key={teacher._id}
                          className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{teacher.name}</span>
                                {teacher.teacherCode && (
                                  <span className="text-sm text-muted-foreground">
                                    ({teacher.teacherCode})
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                {teacher.phone && <span>SĐT: {teacher.phone}</span>}
                                {teacher.accountId?.email && (
                                  <span>Email: {teacher.accountId.email}</span>
                                )}
                              </div>
                              {teacher.subjects && teacher.subjects.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {teacher.subjects.map((sub, idx) => {
                                    const subjectId = typeof sub.subjectId === 'object' && sub.subjectId !== null
                                      ? sub.subjectId._id
                                      : sub.subjectId;
                                    const subject = subjects.find(s => s._id === subjectId);
                                    return subject ? (
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {subject.name}
                                      </Badge>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                {((getYearRole(teacher, selectedViewYearCode || activeYearCode)?.isHomeroom) ?? teacher.isHomeroom) && (
                                  <Badge variant="outline" className="text-xs">GVCN</Badge>
                                )}
                                {((getYearRole(teacher, selectedViewYearCode || activeYearCode)?.isDepartmentHead) ?? teacher.isDepartmentHead) && (
                                  <Badge variant="outline" className="text-xs">TBM</Badge>
                                )}
                                {((getYearRole(teacher, selectedViewYearCode || activeYearCode)?.isLeader) ?? teacher.isLeader) && (
                                  <Badge variant="outline" className="text-xs">BGH</Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveTeacher(teacher._id)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                title="Xóa khỏi tổ"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewingDepartment(null)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog thêm giáo viên vào tổ */}
      <Dialog
        open={isAddTeacherDialogOpen}
        onOpenChange={(open) => {
          setIsAddTeacherDialogOpen(open);
          if (!open) setSelectedTeachersToAdd([]);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thêm giáo viên vào tổ bộ môn</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Chọn nhiều giáo viên để thêm vào tổ: {viewingDepartment?.name}
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {viewingDepartment && getAvailableTeachers(viewingDepartment._id).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Không có giáo viên nào có thể thêm vào tổ này
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Chọn giáo viên ({selectedTeachersToAdd.length} đã chọn)</Label>
                  {viewingDepartment && getAvailableTeachers(viewingDepartment._id).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const availableTeachers = getAvailableTeachers(viewingDepartment._id);
                        const allTeacherIds = availableTeachers.map(t => t._id!).filter(Boolean);
                        if (selectedTeachersToAdd.length === allTeacherIds.length) {
                          // Nếu đã chọn tất cả, bỏ chọn tất cả
                          setSelectedTeachersToAdd([]);
                        } else {
                          // Chọn tất cả
                          setSelectedTeachersToAdd(allTeacherIds);
                        }
                      }}
                    >
                      {selectedTeachersToAdd.length === getAvailableTeachers(viewingDepartment._id).length
                        ? "Bỏ chọn tất cả"
                        : "Chọn tất cả"}
                    </Button>
                  )}
                </div>
                <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  <div className="space-y-2">
                    {viewingDepartment && getAvailableTeachers(viewingDepartment._id).map((teacher) => {
                      const isSelected = selectedTeachersToAdd.includes(teacher._id!);
                      // ✅ Lấy danh sách môn học chung với tổ
                      const commonSubjectNames = (teacher as any).commonSubjectIds
                        ?.map((subjectId: string) => {
                          const subject = subjects.find(s => s._id === subjectId);
                          return subject?.name;
                        })
                        .filter(Boolean) || [];
                      
                      // ✅ Lấy tất cả môn học giáo viên đang dạy
                      const yearRole = getYearRole(teacher, selectedViewYearCode || activeYearCode);
                      const teacherSubjects = (yearRole && yearRole.subjects && yearRole.subjects.length > 0)
                        ? yearRole.subjects
                        : teacher.subjects || [];
                      const allSubjectNames = teacherSubjects
                        .map((sub: any) => {
                          const subjectId = typeof sub.subjectId === 'object' && sub.subjectId !== null
                            ? sub.subjectId._id
                            : sub.subjectId;
                          const subject = subjects.find(s => s._id === subjectId);
                          return subject?.name;
                        })
                        .filter(Boolean);

                      return (
                        <div
                          key={teacher._id}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-accent'
                          }`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTeachersToAdd(prev => prev.filter(id => id !== teacher._id));
                            } else {
                              setSelectedTeachersToAdd(prev => [...prev, teacher._id!]);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <div className="font-medium">
                                {teacher.name} {teacher.teacherCode && `(${teacher.teacherCode})`}
                              </div>
                              {/* ✅ Hiển thị môn học chung với tổ (highlight) */}
                              {commonSubjectNames.length > 0 && (
                                <div className="text-xs mt-1">
                                  <span className="text-muted-foreground">Môn học chung với tổ: </span>
                                  <span className="font-semibold text-primary">
                                    {commonSubjectNames.join(", ")}
                                  </span>
                                  {commonSubjectNames.length > 1 && (
                                    <span className="text-muted-foreground ml-1">
                                      ({commonSubjectNames.length} môn)
                                    </span>
                                  )}
                                </div>
                              )}
                              {/* ✅ Hiển thị tất cả môn học giáo viên đang dạy */}
                              {allSubjectNames.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Tất cả môn đang dạy: {allSubjectNames.join(", ")}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddTeacherDialogOpen(false);
                setSelectedTeachersToAdd([]);
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={handleAddTeachers}
              disabled={selectedTeachersToAdd.length === 0}
            >
              Thêm {selectedTeachersToAdd.length > 0 && `(${selectedTeachersToAdd.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentsList;


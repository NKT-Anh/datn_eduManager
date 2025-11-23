import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Teacher } from "@/types/auth";
import { ClassType } from "@/types/class";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useTeachers, useSubjects, useClasses, useDepartments, useAssignments } from "@/hooks";
import useCurrentAcademicYear from '@/hooks/useCurrentAcademicYear';
// settingApi no longer needed; use `useSchoolYears`
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, User, Search, Eye, Filter, X, AlertTriangle, BookOpen, Home, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TeacherForm } from "@/components/forms/TeacherForm";
import { getTeacherDepartmentId, getTeacherDepartmentName } from '@/utils/teacher';
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
import { assignmentApi } from "@/services/assignmentApi";
import { Loader2, Settings } from "lucide-react";
import { teacherApi } from "@/services/teacherApi";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
 

const TeachersList = () => {
  const navigate = useNavigate();
  
  // ✅ Sử dụng hooks
  const { teachers, isLoading: loading, create: createTeacher, update: updateTeacher, remove: removeTeacher, refetch: refetchTeachers } = useTeachers();
  const { subjects } = useSubjects();
  const { classes } = useClasses();
  const { departments } = useDepartments();
  const { assignments } = useAssignments();
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [batchUpdateSubject, setBatchUpdateSubject] = useState<string>("all");
  const [suggestSubjectId, setSuggestSubjectId] = useState<string>("");
  const [suggestSubjectName, setSuggestSubjectName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  // const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterFlag, setFilterFlag] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"active" | "inactive">("active"); // Mặc định chỉ hiển thị giáo viên đang làm việc
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // ✅ Lấy năm học hiện tại (mã) — ưu tiên schoolYears, fallback settings
  const { currentYearCode, currentYearData, loading: loadingCurrentYear } = useCurrentAcademicYear();
  const activeYearCode = currentYearCode;
  const activeYearName = currentYearData?.name || currentYearCode;

  // Helper: return the year-scoped role entry for the active year (if any)
  const getRoleForActiveYear = (t: any) => {
    if (!t) return null;
    return (t.yearRoles || []).find((r: any) => String(r.schoolYear) === String(activeYearCode)) || null;
  };

  // State cho kiểm tra thiếu giáo viên
  const [missingTeachersData, setMissingTeachersData] = useState<any>(null);
  const [checkMissingLoading, setCheckMissingLoading] = useState(false);

  // State cho dialog cập nhật nhanh
  const [batchUpdateOpen, setBatchUpdateOpen] = useState(false);
  const [batchUpdateLoading, setBatchUpdateLoading] = useState(false);
  // const [batchUpdateSubject, setBatchUpdateSubject] = useState<string>("all");
  const [batchUpdateMaxClasses, setBatchUpdateMaxClasses] = useState<string>("");
  const [batchUpdateWeeklyLessons, setBatchUpdateWeeklyLessons] = useState<string>("");

  // State cho dialog đề xuất giáo viên theo môn học
  const [suggestTeachersOpen, setSuggestTeachersOpen] = useState(false);
  // const [suggestSubjectId, setSuggestSubjectId] = useState<string>("");
  // const [suggestSubjectName, setSuggestSubjectName] = useState<string>("");
  const [suggestTeachers, setSuggestTeachers] = useState<Teacher[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [teacherUpdates, setTeacherUpdates] = useState<Record<string, { maxClasses?: number; weeklyLessons?: number; grades?: string[] }>>({});
  const [exportingExcel, setExportingExcel] = useState(false);

  const { toast } = useToast();

  // ✅ Tự động kiểm tra thiếu giáo viên khi có năm học và auto-refresh
  useEffect(() => {
    const checkMissingTeachers = async () => {
      if (!activeYearCode) return;
      
      try {
        setCheckMissingLoading(true);
        const result = await assignmentApi.checkMissingTeachers({
          year: activeYearCode,
          semester: "1", // Mặc định kiểm tra học kỳ 1
        });
        setMissingTeachersData(result);
      } catch (error) {
        console.error("Lỗi khi kiểm tra thiếu giáo viên:", error);
      } finally {
        setCheckMissingLoading(false);
      }
    };

    if (activeYearCode && teachers.length > 0 && classes.length > 0) {
      // Kiểm tra ngay lập tức
      checkMissingTeachers();
      
      // Tự động refresh mỗi 30 giây
      const interval = setInterval(() => {
        checkMissingTeachers();
      }, 30000); // 30 giây
      
      // Cleanup interval khi component unmount hoặc dependencies thay đổi
      return () => clearInterval(interval);
    }
  }, [activeYearCode, teachers.length, classes.length, assignments.length]);

  // ✅ Nhóm assignments theo teacherId cho năm học hiện tại
  const teachingClassesByTeacher = useMemo(() => {
    if (!activeYearCode || !assignments.length) return new Map<string, Set<string>>();
    
    const map = new Map<string, Set<string>>();
    
    assignments
      .filter(a => a.year === activeYearCode)
      .forEach(assignment => {
        const teacherId = typeof assignment.teacherId === 'object' 
          ? assignment.teacherId?._id 
          : assignment.teacherId;
        const classId = typeof assignment.classId === 'object'
          ? assignment.classId?._id
          : assignment.classId;
        
        if (teacherId && classId) {
          if (!map.has(teacherId)) {
            map.set(teacherId, new Set());
          }
          map.get(teacherId)!.add(classId);
        }
      });
    
    return map;
  }, [assignments, activeYearCode]);

  // ✅ Helper: Lấy tên các lớp đang dạy của giáo viên
  const getTeachingClassNames = (teacherId: string) => {
    const classIds = teachingClassesByTeacher.get(teacherId);
    if (!classIds || classIds.size === 0) return [];
    
    return Array.from(classIds)
      .map(classId => {
        const cls = classes.find(c => c._id === classId);
        return cls?.className || '';
      })
      .filter(Boolean)
      .sort();
  };

  // Helper: Hiển thị tên môn từ entry subject (year-scoped or top-level)
  const getSubjectDisplayName = (entry: any) => {
    if (!entry) return "Chưa có tên";
    const subj = entry.subjectId || entry.subject || entry;
    // If it's an object with name
    if (typeof subj === 'object' && subj !== null) {
      return subj.name || subj._id || "Chưa có tên";
    }
    // If it's a string id, lookup in subjects
    if (typeof subj === 'string') {
      const found = subjects.find(s => s._id === subj || s.code === subj);
      return found?.name || subj || "Chưa có tên";
    }
    return "Chưa có tên";
  };

  // ✅ Không cần load departments nữa vì đã dùng hooks

  const filteredTeachers = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    
    return teachers.filter((t) => {
      // ✅ Loại bỏ giáo viên BGH (Ban giám hiệu) khỏi danh sách — prefer yearRoles
      const role = getRoleForActiveYear(t);
      const isLeaderFlag = role ? Boolean(role.isLeader) : Boolean(t.isLeader);
      if (isLeaderFlag) return false;
      const isHomeroomFlag = role ? Boolean(role.isHomeroom) : Boolean(t.isHomeroom || t.currentHomeroomClassId);
      const isDepartmentHeadFlag = role ? Boolean(role.isDepartmentHead) : Boolean(t.isDepartmentHead);
      
      // 🔍 Tìm kiếm theo nhiều tiêu chí
      const matchesSearch = !searchTerm || 
        t.name.toLowerCase().includes(lowerSearch) ||
        t.teacherCode?.toLowerCase().includes(lowerSearch) ||
        t.accountId?.email?.toLowerCase().includes(lowerSearch) ||
        t.phone?.toLowerCase().includes(lowerSearch) ||
        // Tìm theo môn dạy
        t.subjects?.some((sub) => {
          if (!sub || !sub.subjectId) return false;
          const subjectId = typeof sub.subjectId === 'string' 
            ? sub.subjectId 
            : (sub.subjectId && typeof sub.subjectId === 'object' ? sub.subjectId._id : null) || sub.subjectId;
          const subjectName = typeof sub.subjectId === 'object' && sub.subjectId !== null && sub.subjectId?.name
            ? sub.subjectId.name
            : subjects.find(s => s._id === subjectId)?.name || '';
          return subjectName.toLowerCase().includes(lowerSearch);
        }) ||
        // Tìm theo lớp phụ trách
        t.classIds?.some((clsOrId) => {
          if (!clsOrId) return false;
          const clsObj = typeof clsOrId === "string"
            ? classes.find((c) => c._id === clsOrId)
            : (clsOrId as ClassType);
          const className = clsObj?.className || (typeof clsOrId === 'object' && clsOrId !== null && clsOrId?.className) || '';
          return className.toLowerCase().includes(lowerSearch);
        }) ||
        // Tìm theo tổ bộ môn (ưu tiên yearRoles)
        (getTeacherDepartmentName(t, departments, activeYearCode).toLowerCase().includes(lowerSearch)) ||
        // Tìm theo flags (prefer year-scoped flags)
        (isHomeroomFlag && 'gvcn'.includes(lowerSearch)) ||
        (isDepartmentHeadFlag && 'tbm trưởng bộ môn'.includes(lowerSearch)) ||
        (isLeaderFlag && 'bgh ban giám hiệu'.includes(lowerSearch));

      // 🎯 Lọc theo tổ bộ môn
      const teacherDeptId = getTeacherDepartmentId(t, activeYearName);
      const matchesDepartment = filterDepartment === 'all' || 
        (filterDepartment === 'none' && !teacherDeptId) ||
        (filterDepartment !== 'all' && filterDepartment !== 'none' && teacherDeptId === filterDepartment);

      // 🎯 Lọc theo môn dạy
      const matchesSubject = filterSubject === 'all' ||
        t.subjects?.some((sub) => {
          if (!sub || !sub.subjectId) return false;
          const subjectId = typeof sub.subjectId === 'string' 
            ? sub.subjectId 
            : (sub.subjectId && typeof sub.subjectId === 'object' ? sub.subjectId._id : null) || sub.subjectId;
          return subjectId === filterSubject;
        });

      // 🎯 Lọc theo flags (đã loại bỏ BGH khỏi danh sách)
      const matchesFlag = filterFlag === 'all' ||
        (filterFlag === 'homeroom' && isHomeroomFlag) ||
        (filterFlag === 'departmentHead' && isDepartmentHeadFlag) ||
        (filterFlag === 'normal' && !isHomeroomFlag && !isDepartmentHeadFlag);

      // 🎯 Lọc theo trạng thái (đang làm việc / đã nghỉ việc)
      const matchesStatus = (t.status || 'active') === filterStatus;

      return matchesSearch && matchesDepartment && matchesSubject && matchesFlag && matchesStatus;
    });
  }, [teachers, searchTerm, filterDepartment, filterSubject, filterFlag, filterStatus, subjects, classes]);

  

  // Add / Edit / Delete
  const handleAddTeacher = async (data: any) => {
    try {
      // ✅ Tách departmentId ra khỏi payload để xử lý riêng
      const { departmentId, ...teacherData } = data;
      
      // ✅ Tạo giáo viên
      const newTeacher = await createTeacher(teacherData);
      
      // ✅ Nếu có departmentId, tự động thêm giáo viên vào tổ bộ môn
      if (departmentId && newTeacher._id) {
        try {
          const { departmentApi } = await import("@/services/departmentApi");
          const deptId = typeof departmentId === 'string' ? departmentId : departmentId._id;
          await departmentApi.addTeacher(deptId, newTeacher._id);
        } catch (deptError: any) {
          console.error("Lỗi khi thêm giáo viên vào tổ:", deptError);
          // Không throw error, chỉ log để không ảnh hưởng đến việc tạo giáo viên
        }
      }
      
      toast({ title: "Thành công", description: "Đã thêm giáo viên" + (departmentId ? " và gán vào tổ bộ môn" : "") });
      setIsAddDialogOpen(false);
      // ✅ Tự động refetch để cập nhật danh sách
      refetchTeachers();
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
      await updateTeacher({ id: editingTeacher._id!, data });
      toast({ title: "Thành công", description: "Đã cập nhật giáo viên" });
      setEditingTeacher(null);
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
      await removeTeacher(deletingTeacher._id!);
      toast({ title: "Thành công", description: "Đã xóa giáo viên" });
      setDeletingTeacher(null);
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

  const openDialog = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsDialogOpen(true);
  };
  const closeDialog = () => {
    setSelectedTeacher(null);
    setIsDialogOpen(false);
  };

  // ✅ Handler toggle status nhanh
  const handleToggleStatus = async (teacherId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await updateTeacher({ id: teacherId, data: { status: newStatus } });
      toast({
        title: "Thành công",
        description: `Đã ${newStatus === 'active' ? 'kích hoạt' : 'vô hiệu hóa'} giáo viên`,
      });
      refetchTeachers();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || error.message || "Cập nhật thất bại",
        variant: "destructive",
      });
    }
  };

  // ✅ Handler mở dialog đề xuất giáo viên cho môn học
  const handleSuggestTeachers = async (subjectId: string, subjectName: string) => {
    setSuggestSubjectId(subjectId);
    setSuggestSubjectName(subjectName);
    setSuggestTeachersOpen(true);
    setSuggestLoading(true);
    setTeacherUpdates({});

    try {
      // Lấy danh sách giáo viên dạy môn này (loại bỏ giáo viên BGH)
      const teachersForSubject = teachers.filter(teacher => {
        // Loại bỏ giáo viên BGH (Ban giám hiệu) — prefer yearRoles
        const tRole = getRoleForActiveYear(teacher);
        const isLeaderFlagLocal = tRole ? Boolean(tRole.isLeader) : Boolean(teacher.isLeader);
        if (isLeaderFlagLocal) return false;
        
        if (teacher.status !== 'active') return false;
        
        // Kiểm tra mainSubject
        if (teacher.mainSubject && (typeof teacher.mainSubject === 'object' ? teacher.mainSubject._id : teacher.mainSubject) === subjectId) {
          return true;
        }
        // Kiểm tra subjects
        return teacher.subjects?.some(sub => {
          const subId = typeof sub.subjectId === 'object' ? sub.subjectId?._id : sub.subjectId;
          return subId === subjectId;
        });
      });

      setSuggestTeachers(teachersForSubject);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tải danh sách giáo viên",
        variant: "destructive",
      });
    } finally {
      setSuggestLoading(false);
    }
  };

  // ✅ Handler cập nhật giáo viên trong dialog đề xuất
  const handleUpdateTeacherInSuggest = async (teacherId: string) => {
    const updates = teacherUpdates[teacherId];
    if (!updates || (!updates.maxClasses && !updates.weeklyLessons && !updates.grades)) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập ít nhất một giá trị để cập nhật",
        variant: "destructive",
      });
      return;
    }

    try {
      const updateData: any = {};
      if (updates.maxClasses !== undefined) updateData.maxClasses = updates.maxClasses;
      if (updates.weeklyLessons !== undefined) updateData.weeklyLessons = updates.weeklyLessons;
      if (updates.grades !== undefined) {
        // Cập nhật grades trong subjects
        const teacher = teachers.find(t => t._id === teacherId);
        if (teacher) {
          const subjectIndex = teacher.subjects?.findIndex(sub => {
            const subId = typeof sub.subjectId === 'object' ? sub.subjectId?._id : sub.subjectId;
            return subId === suggestSubjectId;
          });
          if (subjectIndex !== undefined && subjectIndex >= 0 && teacher.subjects) {
            updateData.subjects = [...teacher.subjects];
            updateData.subjects[subjectIndex] = {
              ...updateData.subjects[subjectIndex],
              grades: updates.grades
            };
          }
        }
      }

      await updateTeacher({ id: teacherId, data: updateData });
      toast({
        title: "Thành công",
        description: "Đã cập nhật giáo viên",
      });
      
      // Xóa updates đã lưu
      const newUpdates = { ...teacherUpdates };
      delete newUpdates[teacherId];
      setTeacherUpdates(newUpdates);
      
      refetchTeachers();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || error.message || "Cập nhật thất bại",
        variant: "destructive",
      });
    }
  };

  // ✅ Handler xuất Excel
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const blob = await teacherApi.exportToExcel({
        status: filterStatus,
      });

      // ✅ Tạo link download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Danh_sach_giao_vien_${filterStatus === 'active' ? 'dang_lam_viec' : filterStatus === 'inactive' ? 'nghi_viec' : 'tat_ca'}_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Thành công",
        description: "Đã xuất file Excel thành công!",
      });
    } catch (err: any) {
      console.error("Lỗi xuất Excel:", err);
      toast({
        title: "Lỗi",
        description: `Lỗi xuất Excel: ${err?.response?.data?.message || err?.message || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setExportingExcel(false);
    }
  };

  // ✅ Handler lưu tất cả giáo viên có thay đổi
  const handleSaveAllTeachers = async () => {
    const teachersToUpdate = Object.keys(teacherUpdates).filter(teacherId => {
      const updates = teacherUpdates[teacherId];
      return updates && (updates.maxClasses !== undefined || updates.weeklyLessons !== undefined || updates.grades !== undefined);
    });

    if (teachersToUpdate.length === 0) {
      toast({
        title: "Thông báo",
        description: "Không có thay đổi nào để lưu",
        variant: "default",
      });
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      // Cập nhật từng giáo viên
      for (const teacherId of teachersToUpdate) {
        try {
          const updates = teacherUpdates[teacherId];
          if (!updates) continue;

          const teacher = teachers.find(t => t._id === teacherId);
          if (!teacher) continue;

          const updateData: any = {};

          // Cập nhật maxClasses nếu có
          if (updates.maxClasses !== undefined) {
            updateData.maxClasses = updates.maxClasses;
          }

          // Cập nhật weeklyLessons nếu có
          if (updates.weeklyLessons !== undefined) {
            updateData.weeklyLessons = updates.weeklyLessons;
          }

          // Cập nhật grades nếu có
          if (updates.grades !== undefined) {
            const subjectIndex = teacher.subjects?.findIndex(sub => {
              const subId = typeof sub.subjectId === 'object' ? sub.subjectId?._id : sub.subjectId;
              return subId === suggestSubjectId;
            });
            if (subjectIndex !== undefined && subjectIndex >= 0 && teacher.subjects) {
              updateData.subjects = [...teacher.subjects];
              updateData.subjects[subjectIndex] = {
                ...updateData.subjects[subjectIndex],
                grades: updates.grades
              };
            }
          }

          await updateTeacher({ id: teacherId, data: updateData });
          successCount++;
        } catch (error) {
          console.error(`Lỗi khi cập nhật giáo viên ${teacherId}:`, error);
          errorCount++;
        }
      }

      // Hiển thị kết quả
      if (errorCount === 0) {
        toast({
          title: "Thành công",
          description: `Đã cập nhật ${successCount} giáo viên`,
        });
      } else {
        toast({
          title: "Hoàn thành",
          description: `Đã cập nhật ${successCount} giáo viên, ${errorCount} giáo viên lỗi`,
          variant: "default",
        });
      }

      // Xóa tất cả updates đã lưu
      setTeacherUpdates({});
      refetchTeachers();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi lưu tất cả",
        variant: "destructive",
      });
    }
  };

  // ✅ Handler cập nhật nhanh số lớp tối đa và số tiết tối đa/tuần
  const handleBatchUpdateLimits = async () => {
    // Kiểm tra input trước khi xử lý
    const maxClassesTrimmed = batchUpdateMaxClasses?.trim() || "";
    const weeklyLessonsTrimmed = batchUpdateWeeklyLessons?.trim() || "";
    
    if (!maxClassesTrimmed && !weeklyLessonsTrimmed) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập ít nhất một giá trị (Số lớp tối đa hoặc Số tiết tối đa/tuần)",
        variant: "destructive",
      });
      return;
    }

    try {
      setBatchUpdateLoading(true);
      
      // ✅ Build payload - chỉ thêm các field có giá trị
      const payload: any = {};

      // Xử lý subjectId - chỉ thêm nếu có giá trị hợp lệ
      // Nếu là "all" hoặc không có, không gửi subjectId (backend sẽ hiểu là cập nhật TẤT CẢ giáo viên)
      if (batchUpdateSubject && batchUpdateSubject !== 'all') {
        payload.subjectId = batchUpdateSubject;
      }

      // Xử lý maxClasses
      if (maxClassesTrimmed) {
        const maxClassesNum = parseInt(maxClassesTrimmed, 10);
        if (isNaN(maxClassesNum) || maxClassesNum < 1) {
          toast({
            title: "Lỗi",
            description: "Số lớp tối đa phải là số nguyên dương (>= 1)",
            variant: "destructive",
          });
          setBatchUpdateLoading(false);
          return;
        }
        payload.maxClasses = maxClassesNum;
      }

      // Xử lý weeklyLessons
      if (weeklyLessonsTrimmed) {
        const weeklyLessonsNum = parseInt(weeklyLessonsTrimmed, 10);
        if (isNaN(weeklyLessonsNum) || weeklyLessonsNum < 1) {
          toast({
            title: "Lỗi",
            description: "Số tiết tối đa/tuần phải là số nguyên dương (>= 1)",
            variant: "destructive",
          });
          setBatchUpdateLoading(false);
          return;
        }
        payload.weeklyLessons = weeklyLessonsNum;
      }

      // Kiểm tra lại: phải có ít nhất một giá trị hợp lệ
      if (!payload.maxClasses && !payload.weeklyLessons) {
        toast({
          title: "Lỗi",
          description: "Vui lòng nhập ít nhất một giá trị hợp lệ (Số lớp tối đa hoặc Số tiết tối đa/tuần)",
          variant: "destructive",
        });
        setBatchUpdateLoading(false);
        return;
      }

      console.log('📤 Sending batch update payload:', JSON.stringify(payload, null, 2));
      console.log('📤 Updating:', batchUpdateSubject === 'all' ? 'TẤT CẢ giáo viên' : `Giáo viên dạy môn ${subjects.find(s => s._id === batchUpdateSubject)?.name}`);

      const result = await teacherApi.batchUpdateLimits(payload);

      console.log('✅ Batch update result:', result);

      const updateScope = batchUpdateSubject === 'all' 
        ? 'TẤT CẢ giáo viên' 
        : `giáo viên dạy môn ${subjects.find(s => s._id === batchUpdateSubject)?.name}`;

      toast({
        title: "Thành công",
        description: result.message || `Đã cập nhật ${result.modifiedCount} giáo viên (${updateScope})`,
      });

      // Reset form và đóng dialog
      setBatchUpdateSubject("all");
      setBatchUpdateMaxClasses("");
      setBatchUpdateWeeklyLessons("");
      setBatchUpdateOpen(false);
      
      // Refresh danh sách giáo viên
      refetchTeachers();
    } catch (error: any) {
      console.error('❌ Batch update error:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error response data:', error.response?.data);
      
      // Hiển thị chi tiết lỗi từ backend
      const errorData = error.response?.data;
      let errorMessage = "Cập nhật thất bại";
      
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Lỗi",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setBatchUpdateLoading(false);
    }
  };

  const nonBghTeachers = useMemo(() => {
    return teachers.filter(t => {
      const role = getRoleForActiveYear(t);
      const isLeaderFlag = role ? Boolean(role.isLeader) : Boolean(t.isLeader);
      return !isLeaderFlag;
    });
  }, [teachers, activeYearCode]);

  // ✅ Bổ sung: Tính thống kê giáo viên theo môn học (loại bỏ BGH)
  const subjectStats = useMemo(() => {
    const stats: Record<string, { count: number; grades: Set<string> }> = {};

    nonBghTeachers.forEach((teacher) => {
      teacher.subjects?.forEach((sub) => {
        // Xử lý cả trường hợp subjectId là string hoặc object
        let subjectName = "Không rõ";
        if (typeof sub.subjectId === 'object' && sub.subjectId !== null && sub.subjectId?.name) {
          subjectName = sub.subjectId.name;
        } else if (typeof sub.subjectId === 'string') {
          // ✅ TypeScript đã biết sub.subjectId là string ở đây
          const subjectIdStr = sub.subjectId;
          const foundSubject = subjects.find(s => s._id === subjectIdStr);
          subjectName = foundSubject?.name || "Không rõ";
        }
        
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
  }, [nonBghTeachers, subjects]);

  // Update filteredTeachers to respect year-scoped role flags

  // ✅ Lọc danh sách tổ bộ môn theo năm học hiện tại để load theo năm
  const departmentsForSelect = useMemo(() => {
    if (!activeYearName) return departments;
    return departments.filter(d => d.schoolYear === activeYearName);
  }, [departments, activeYearName]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quản lý giáo viên</h1>
          <p className="text-muted-foreground">
            Quản lý thông tin giáo viên trong hệ thống
          </p>
        </div>

        <div className="flex gap-2">
          {/* Nút Export Excel */}
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={exportingExcel}
          >
            {exportingExcel ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xuất...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Xuất Excel
              </>
            )}
          </Button>

        {/* Nút Import Excel */}
        <ImportTeachersDialog
          subjects={subjects}
          classes={classes}
          onImported={refetchTeachers}
        />

          {/* Nút Cập nhật nhanh */}
          <Dialog open={batchUpdateOpen} onOpenChange={setBatchUpdateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" /> Cập nhật nhanh
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Cập nhật nhanh số lớp tối đa & số tiết tối đa/tuần</DialogTitle>
                <DialogDescription>
                  Cập nhật hàng loạt cho tất cả giáo viên hoặc chỉ giáo viên dạy môn học cụ thể
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Chọn môn học */}
                <div>
                  <Label htmlFor="subject-select">Chọn môn học</Label>
                  <Select
                    value={batchUpdateSubject}
                    onValueChange={setBatchUpdateSubject}
                  >
                    <SelectTrigger id="subject-select" className="mt-1">
                      <SelectValue placeholder="Tất cả giáo viên" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả giáo viên</SelectItem>
                      {subjects.map((subject) => (
                        <SelectItem key={subject._id} value={subject._id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {batchUpdateSubject === 'all' ? (
                    <p className="text-xs text-blue-600 font-medium mt-1">
                      ⚠️ Sẽ cập nhật <strong>TẤT CẢ</strong> giáo viên (trừ BGH và giáo viên đã nghỉ việc)
                    </p>
                  ) : batchUpdateSubject && batchUpdateSubject !== 'all' ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Chỉ cập nhật giáo viên dạy môn: <strong>{subjects.find(s => s._id === batchUpdateSubject)?.name}</strong>
                    </p>
                  ) : null}
                </div>

                {/* Số lớp tối đa */}
                <div>
                  <Label htmlFor="max-classes">Số lớp tối đa có thể dạy</Label>
                  <Input
                    id="max-classes"
                    type="number"
                    min="0"
                    value={batchUpdateMaxClasses}
                    onChange={(e) => setBatchUpdateMaxClasses(e.target.value)}
                    placeholder="VD: 3 (để trống = không thay đổi)"
                    className="mt-1"
                  />
                </div>

                {/* Số tiết tối đa/tuần */}
                <div>
                  <Label htmlFor="weekly-lessons">Số tiết tối đa/tuần</Label>
                  <Input
                    id="weekly-lessons"
                    type="number"
                    min="0"
                    value={batchUpdateWeeklyLessons}
                    onChange={(e) => setBatchUpdateWeeklyLessons(e.target.value)}
                    placeholder="VD: 19 (để trống = không thay đổi)"
                    className="mt-1"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBatchUpdateOpen(false);
                    setBatchUpdateSubject("all");
                    setBatchUpdateMaxClasses("");
                    setBatchUpdateWeeklyLessons("");
                  }}
                  disabled={batchUpdateLoading}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleBatchUpdateLimits}
                  disabled={batchUpdateLoading}
                >
                  {batchUpdateLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang cập nhật...
                    </>
                  ) : (
                    "Cập nhật"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
              departments={departments}
          />
        </Dialog>
        </div>
      </div>

      {/* ✅ Card hiển thị môn/khối thiếu giáo viên */}
      {(missingTeachersData || checkMissingLoading) && (
        <Card className={`border-2 ${
          missingTeachersData?.summary.totalMissing > 0 
            ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20' 
            : 'border-green-300 bg-green-50 dark:bg-green-900/20'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                {checkMissingLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary mt-0.5" />
                ) : missingTeachersData?.summary.totalMissing > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    {checkMissingLoading 
                      ? "Đang kiểm tra môn/khối thiếu giáo viên..." 
                      : missingTeachersData?.summary.totalMissing > 0
                      ? `⚠️ Phát hiện ${missingTeachersData.summary.totalMissing} lớp/môn thiếu giáo viên`
                      : "✅ Tất cả các lớp đã có giáo viên được phân công"}
                  </h3>
                  {missingTeachersData && !checkMissingLoading && (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Năm học {activeYearName} - Học kỳ 1 | 
                        Tổng {missingTeachersData.summary.totalClasses} lớp
                        {missingTeachersData.summary.totalMissing > 0 && (
                          <> | <span className="text-orange-600 font-medium">{missingTeachersData.summary.totalMissing} lớp/môn thiếu</span></>
                        )}
                      </p>

                      {/* Hiển thị môn/khối thiếu giáo viên */}
                      {missingTeachersData.summary.totalMissing > 0 && missingTeachersData.summary.bySubject.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium">Môn học và khối thiếu giáo viên:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {missingTeachersData.summary.bySubject.map((subject: any) => {
                              // Nhóm các lớp thiếu theo khối
                              const classesByGrade = subject.missingClasses.reduce((acc: any, cls: any) => {
                                const classInfo = classes.find(c => c._id === cls.classId);
                                const grade = classInfo?.grade || 'Không xác định';
                                if (!acc[grade]) acc[grade] = [];
                                acc[grade].push(cls);
                                return acc;
                              }, {});

                              return (
                                <Card key={subject.subjectId} className="p-2 border-orange-200">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm flex items-center gap-1">
                                        <BookOpen className="h-3 w-3" />
                                        {subject.subjectName}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Thiếu {subject.missingClassesCount} lớp
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {Object.entries(classesByGrade).map(([grade, classesList]: [string, any]) => (
                                          <Badge key={grade} variant="outline" className="text-xs">
                                            Khối {grade}: {classesList.length} lớp
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSuggestTeachers(subject.subjectId, subject.subjectName)}
                                      className="shrink-0"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Thêm GV
                                    </Button>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {missingTeachersData && missingTeachersData.summary.totalMissing > 0 && (
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      navigate('/admin/teachingAssignmentPage');
                    }}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Xem chi tiết
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => {
                      navigate('/admin/teachingAssignmentPage');
                    }}
                  >
                    🤖 Phân công ngay
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col items-start gap-4">
          <div className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Danh sách giáo viên
            </CardTitle>
            <Badge variant="secondary" className="text-sm">
              {filteredTeachers.length} / {nonBghTeachers.length} giáo viên
            </Badge>
          </div>
          
          {/* Tìm kiếm */}
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, mã GV, email, SĐT, môn dạy, lớp, tổ bộ môn..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Bộ lọc */}
          <div className="flex items-center gap-3 w-full flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Lọc:</span>
            </div>
            
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tổ bộ môn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả tổ bộ môn</SelectItem>
                <SelectItem value="none">Chưa có tổ</SelectItem>
                {departmentsForSelect.map((dept) => (
                  <SelectItem key={dept._id} value={dept._id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Môn dạy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả môn</SelectItem>
                {subjects.map((sub) => (
                  <SelectItem key={sub._id} value={sub._id}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterFlag} onValueChange={setFilterFlag}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả vai trò</SelectItem>
                <SelectItem value="normal">Giáo viên thường</SelectItem>
                <SelectItem value="homeroom">Giáo viên chủ nhiệm</SelectItem>
                <SelectItem value="departmentHead">Trưởng bộ môn</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "active" | "inactive")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Đang làm việc</SelectItem>
                <SelectItem value="inactive">Đã nghỉ việc</SelectItem>
              </SelectContent>
            </Select>

            {(filterDepartment !== 'all' || filterSubject !== 'all' || filterFlag !== 'all' || filterStatus !== 'active') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterDepartment('all');
                  setFilterSubject('all');
                  setFilterFlag('all');
                  setFilterStatus('active');
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Đang tải danh sách giáo viên...</p>
              </div>
            </div>
          ) : (
            <Table className="w-full table-auto">
              <TableHeader>
                <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Mã GV</TableHead>
                    <TableHead>Năm</TableHead>
                    <TableHead>GV chủ nhiệm</TableHead>
                    <TableHead>Trưởng bộ môn</TableHead>
                    <TableHead>Môn chính</TableHead>
                    <TableHead>Tổ bộ môn</TableHead>
                    <TableHead>Số tiết còn lại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filteredTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Không tìm thấy giáo viên nào
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeachers.map((teacher) => {
                  const departmentName = getTeacherDepartmentName(teacher, departments, activeYearCode);
                  const role = getRoleForActiveYear(teacher);
                  const isHomeroomFlag = role ? Boolean(role.isHomeroom) : Boolean(teacher.isHomeroom || teacher.currentHomeroomClassId);
                  const isDepartmentHeadFlag = role ? Boolean(role.isDepartmentHead) : Boolean(teacher.isDepartmentHead);
                  const displayYear = role?.schoolYear || activeYearName || activeYearCode;

                  // ✅ Tính số tiết đã phân công
                  const teacherAssignments = assignments.filter(
                    (a) =>
                      a.teacherId?._id === teacher._id &&
                      (!activeYearCode || a.year === activeYearCode) &&
                      a.semester === "1"
                  );

                  // Helper để lấy số tiết/tuần của môn học
                  const getSubjectPeriods = (subjectId: string, grade: string): number => {
                    const subject = subjects.find((s) => s._id === subjectId);
                    if (!subject) return 2;

                    const subjectName = subject.name.toLowerCase();
                    const periodsMap: Record<string, number> = {
                      toán: 4,
                      "ngữ văn": 4,
                      văn: 4,
                      "tiếng anh": 3,
                      anh: 3,
                      "vật lý": 2,
                      "hóa học": 2,
                      hóa: 2,
                      "sinh học": 2,
                      sinh: 2,
                      "lịch sử": 2,
                      "địa lý": 2,
                      địa: 2,
                      "giáo dục công dân": 1,
                      gdcd: 1,
                      "thể dục": 2,
                      "công nghệ": 1,
                      "tin học": 1,
                      tin: 1,
                    };

                    for (const [key, periods] of Object.entries(periodsMap)) {
                      if (subjectName.includes(key)) return periods;
                    }
                    return 2;
                  };

                  let assignedPeriods = 0;
                  teacherAssignments.forEach((assignment) => {
                    const classGrade = assignment.classId?.grade || "10";
                    const subjectId = assignment.subjectId?._id || "";
                    assignedPeriods += getSubjectPeriods(subjectId, classGrade);
                  });

                  // ✅ Tính số tiết tối đa thực tế (bao gồm số tiết bổ sung)
                  let maxWeeklyLessons = 0;
                  
                  // ✅ Sử dụng effectiveWeeklyLessons từ backend (virtual field) nếu có
                  if (teacher.effectiveWeeklyLessons !== undefined) {
                    maxWeeklyLessons = teacher.effectiveWeeklyLessons;
                  } else {
                    // Tính thủ công: base (17) - giảm tiết (nếu có chức vụ) + số tiết tự chọn
                    const baseWeeklyLessons = 17; // ✅ Base theo quy tắc THPT
                    let reduction = 0;

                    // Prefer year-scoped role flags for reduction calculation
                    const role = getRoleForActiveYear(teacher);
                    const isHomeroomFlag = role ? Boolean(role.isHomeroom) : Boolean(teacher.isHomeroom || teacher.currentHomeroomClassId);
                    const isDepartmentHeadFlag = role ? Boolean(role.isDepartmentHead) : Boolean(teacher.isDepartmentHead);

                    // GV chủ nhiệm: giảm 3 tiết
                    if (isHomeroomFlag) {
                      reduction = Math.max(reduction, 3);
                    }

                    // Tổ trưởng: giảm 3 tiết
                    if (isDepartmentHeadFlag) {
                      reduction = Math.max(reduction, 3);
                    }

                    // Số tiết cơ bản sau khi trừ
                    const baseAfterReduction = Math.max(0, baseWeeklyLessons - reduction);
                    const optionalLessons = teacher.optionalWeeklyLessons || 0;
                    const calculatedEffective = baseAfterReduction + optionalLessons;

                    // ✅ Áp dụng cap limit từ weeklyLessons
                    const capLimit = teacher.weeklyLessons || null;
                    maxWeeklyLessons = capLimit !== null ? Math.min(calculatedEffective, capLimit) : calculatedEffective;
                  }
                  
                  const remainingPeriods = Math.max(0, maxWeeklyLessons - assignedPeriods);

                  return (
                    <TableRow key={teacher._id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                      <TableCell>{teacher.teacherCode || "-"}</TableCell>
                      <TableCell>{displayYear}</TableCell>
                      <TableCell>
                        {isHomeroomFlag ? (
                          <Badge variant="default" className="text-xs">GV chủ nhiệm</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isDepartmentHeadFlag ? (
                          <Badge variant="secondary" className="text-xs">Trưởng bộ môn</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                          {teacher.mainSubject ? (
                            <Badge variant="default" className="text-xs">
                              {typeof teacher.mainSubject === 'object' 
                                ? teacher.mainSubject.name 
                                : "-"}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Hiển thị tên tổ bộ môn theo yearRoles (active year) — ưu tiên year-scoped department
                          const deptName = getTeacherDepartmentName(teacher, departments, activeYearCode);
                          if (deptName && deptName !== "-") {
                            return (
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="text-xs">{deptName}</Badge>
                              </div>
                            );
                          }
                          return <span className="text-muted-foreground italic text-xs">Chưa phân công</span>;
                        })()}
                      </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${remainingPeriods === 0 ? 'text-red-600' : remainingPeriods < 5 ? 'text-orange-600' : 'text-green-600'}`}>
                            {remainingPeriods}
                            </span>
                          <span className="text-xs text-muted-foreground">
                            / {maxWeeklyLessons} tiết
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={teacher.status === 'active'}
                            onCheckedChange={() => handleToggleStatus(teacher._id!, teacher.status || 'active')}
                            title={teacher.status === 'active' ? 'Đang làm việc' : 'Đã nghỉ việc'}
                          />
                          {teacher.status === 'inactive' && (
                            <Badge variant="destructive" className="text-xs">Đã nghỉ việc</Badge>
                          )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDialog(teacher)}
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Dialog
                          open={!!editingTeacher && editingTeacher._id === teacher._id}
                          onOpenChange={(open) => !open && setEditingTeacher(null)}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingTeacher(teacher)}
                            title="Chỉnh sửa"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {editingTeacher && editingTeacher._id === teacher._id && (
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
                  {nonBghTeachers.length}
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
        assignments={assignments}
        subjects={subjects}
        classes={classes}
        currentYear={activeYearCode}
        semester="1"
      />

      <DeleteConfirmDialog
        open={!!deletingTeacher}
        onOpenChange={() => setDeletingTeacher(null)}
        onConfirm={handleDeleteTeacher}
        title="Xóa giáo viên"
        description={`Bạn có chắc chắn muốn xóa giáo viên "${deletingTeacher?.name}"?`}
      />

      {/* Dialog đề xuất giáo viên cho môn học */}
      <Dialog open={suggestTeachersOpen} onOpenChange={setSuggestTeachersOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Đề xuất giáo viên cho môn: {suggestSubjectName}</DialogTitle>
            <DialogDescription>
              Danh sách giáo viên có thể dạy môn này. Bạn có thể cập nhật nhanh số lớp tối đa, số tiết tối đa/tuần và khối giảng dạy.
            </DialogDescription>
          </DialogHeader>

          {suggestLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : suggestTeachers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có giáo viên nào dạy môn này
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {suggestTeachers.map((teacher) => {
                const teacherSubject = teacher.subjects?.find(sub => {
                  const subId = typeof sub.subjectId === 'object' ? sub.subjectId?._id : sub.subjectId;
                  return subId === suggestSubjectId;
                });
                const currentGrades = teacherSubject?.grades || [];
                const updates = teacherUpdates[teacher._id!] || {};

                return (
                  <Card key={teacher._id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{teacher.name}</h4>
                          <p className="text-sm text-muted-foreground">{teacher.teacherCode}</p>
                        </div>
                        <Badge variant={teacher.status === 'active' ? 'default' : 'secondary'}>
                          {teacher.status === 'active' ? 'Đang làm việc' : 'Đã nghỉ việc'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {/* Số lớp tối đa */}
                        <div>
                          <Label className="text-xs">Số lớp tối đa</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">Hiện tại: {teacher.maxClasses || 3}</span>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Cập nhật"
                              value={updates.maxClasses !== undefined ? updates.maxClasses : ''}
                              onChange={(e) => {
                                const value = e.target.value ? parseInt(e.target.value) : undefined;
                                setTeacherUpdates({
                                  ...teacherUpdates,
                                  [teacher._id!]: {
                                    ...updates,
                                    maxClasses: value
                                  }
                                });
                              }}
                              className="w-20"
                            />
                          </div>
                        </div>

                        {/* Số tiết tối đa/tuần */}
                        <div>
                          <Label className="text-xs">Số tiết tối đa/tuần</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">Hiện tại: {teacher.weeklyLessons || 17}</span>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Cập nhật"
                              value={updates.weeklyLessons !== undefined ? updates.weeklyLessons : ''}
                              onChange={(e) => {
                                const value = e.target.value ? parseInt(e.target.value) : undefined;
                                setTeacherUpdates({
                                  ...teacherUpdates,
                                  [teacher._id!]: {
                                    ...updates,
                                    weeklyLessons: value
                                  }
                                });
                              }}
                              className="w-20"
                            />
                          </div>
                        </div>

                        {/* Khối giảng dạy */}
                        <div>
                          <Label className="text-xs">Khối giảng dạy</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(['10', '11', '12'] as const).map((grade) => (
                              <label key={grade} className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={updates.grades ? updates.grades.includes(grade) : currentGrades.includes(grade as "10" | "11" | "12")}
                                  onChange={(e) => {
                                    const newGrades = updates.grades || [...currentGrades];
                                    if (e.target.checked) {
                                      if (!newGrades.includes(grade)) {
                                        newGrades.push(grade);
                                      }
                                    } else {
                                      const index = newGrades.indexOf(grade);
                                      if (index > -1) {
                                        newGrades.splice(index, 1);
                                      }
                                    }
                                    setTeacherUpdates({
                                      ...teacherUpdates,
                                      [teacher._id!]: {
                                        ...updates,
                                        grades: newGrades
                                      }
                                    });
                                  }}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm">Khối {grade}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      {(updates.maxClasses !== undefined || updates.weeklyLessons !== undefined || updates.grades !== undefined) && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateTeacherInSuggest(teacher._id!)}
                          >
                            Lưu thay đổi
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <DialogFooter>
            {Object.keys(teacherUpdates).length > 0 && (
              <Button 
                onClick={handleSaveAllTeachers}
                className="mr-auto"
              >
                Lưu tất cả ({Object.keys(teacherUpdates).filter(id => {
                  const updates = teacherUpdates[id];
                  return updates && (updates.maxClasses !== undefined || updates.weeklyLessons !== undefined || updates.grades !== undefined);
                }).length} giáo viên)
              </Button>
            )}
            <Button variant="outline" onClick={() => {
              setSuggestTeachersOpen(false);
              setTeacherUpdates({});
            }}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeachersList;

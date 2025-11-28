import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, BookOpen, Loader2, AlertTriangle, Search, FileText, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Lock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { proposalApi, TeachingAssignmentProposal } from "@/services/proposalApi";

// ✅ Sử dụng hooks thay vì API trực tiếp
import {
  useAssignments,
  useSubjects,
  useClasses,
  useTeachers,
  useSchoolYears,
} from "@/hooks";

import { TeachingAssignmentPayload } from "@/types/class";

import { assignmentApi } from "@/services/assignmentApi";
import { teacherApi } from "@/services/teacherApi";
import { classPeriodsApi } from "@/services/classPeriodsApi";

// Schema cho form thêm mới
const assignmentSchema = z.object({
  teacherId: z.string().min(1, "Vui lòng chọn giáo viên"),
  subjectId: z.string().min(1, "Vui lòng chọn môn học"),
  classId: z.string().min(1, "Vui lòng chọn lớp"),
  year: z.string().min(1, "Vui lòng chọn năm học"),

  semester: z.enum(["1", "2"], { required_error: "Chọn học kỳ" }),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

export default function TeachingAssignmentPage() {
  // ✅ Sử dụng hooks để lấy data
  const { subjects } = useSubjects();
  const { classes } = useClasses();
  const { teachers } = useTeachers();
  const { schoolYears: allSchoolYears } = useSchoolYears();

  // ✅ Map school years và tìm năm học hiện tại
  const { schoolYears, currentYear } = useMemo(() => {
    const mapped = allSchoolYears.map((y: any) => ({
      code: y.code,
      name: y.name,
      isCurrent: y.isActive,
    }));
    const current = mapped.find((y) => y.isCurrent) || mapped[0];
    return {
      schoolYears: mapped,
      currentYear: current?.code || "",
    };
  }, [allSchoolYears]);

  const [open, setOpen] = useState(false);
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterSemester, setFilterSemester] = useState<"1" | "2">("1");

  // ✅ Sử dụng hooks để lấy data - filter theo năm học ở backend
  const { assignments: allAssignments, create: createAssignment, update: updateAssignment, remove: removeAssignment, createBulk, refetch: refetchAssignments } = useAssignments(
    filterYear ? { year: filterYear } : undefined
  );

  // ✅ Sắp xếp assignments theo tên lớp
  const assignments = useMemo(() => {
    return [...allAssignments].sort((a, b) =>
      a.classId?.className?.localeCompare(b.classId?.className || "") || 0
    );
  }, [allAssignments]);
  
  
  // ✅ Dialog states
  const [confirmAutoAssignDialog, setConfirmAutoAssignDialog] = useState(false);
  const [deleteYearDialog, setDeleteYearDialog] = useState(false);
  const [deleteYearInput, setDeleteYearInput] = useState({ year: "", semester: "all" });
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);
  
  const { toast } = useToast();

  const getCurrentSchoolYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  // State cho dialog auto assign
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [autoYear, setAutoYear] = useState("");
  const [autoYearInput, setAutoYearInput] = useState("");
  const [useCustomYear, setUseCustomYear] = useState(false);
  const [autoSemester, setAutoSemester] = useState<"1" | "2">("1");
  const [selectedGrades, setSelectedGrades] = useState<string[]>(["10"]);

  // State cho dialog kiểm tra môn thiếu giáo viên
  const [checkMissingOpen, setCheckMissingOpen] = useState(false);
  const [checkMissingLoading, setCheckMissingLoading] = useState(false);
  const [missingTeachersData, setMissingTeachersData] = useState<any>(null);
  const [checkYear, setCheckYear] = useState(getCurrentSchoolYear());
  const [checkSemester, setCheckSemester] = useState<"1" | "2">("1");
  const [checkGrade, setCheckGrade] = useState<string>("all");

  // State cho auto-check khi vào trang
  const [autoCheckLoading, setAutoCheckLoading] = useState(false);
  const [autoCheckData, setAutoCheckData] = useState<any>(null);

  // ✅ State cho proposal (đề xuất)
  const { backendUser } = useAuth();
  const isDepartmentHead = backendUser?.teacherFlags?.isDepartmentHead || false;
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const [proposals, setProposals] = useState<TeachingAssignmentProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [teacherLoadMap, setTeacherLoadMap] = useState<Record<string, { current: number; effective: number; remaining: number }>>({});
  const [teacherLoadLoading, setTeacherLoadLoading] = useState(false);
  const [showTeacherLoadCard, setShowTeacherLoadCard] = useState(false);
  const [showAutoCheckCard, setShowAutoCheckCard] = useState(true);
  const [classPeriodsMap, setClassPeriodsMap] = useState<Record<string, number>>({}); // { "subjectId_classId": periods }
  const [assignmentLocks, setAssignmentLocks] = useState<Record<string, { gradeCount: number; locked: boolean }>>({}); // { assignmentId: { gradeCount, locked } }
  const [publishing, setPublishing] = useState(false);

  const form = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { year: currentYear || getCurrentSchoolYear(), semester: "1" },
  });

  const teacherLoadList = useMemo(() => {
    return teachers
      .filter((teacher: any) => !teacher.teacherFlags?.isLeader) // Loại bỏ giáo viên BGH
      .map((teacher: any) => {
        const load = teacherLoadMap[teacher._id] || {
          current: 0,
          effective: teacher.effectiveWeeklyLessons || teacher.weeklyLessons || 17,
          remaining: teacher.effectiveWeeklyLessons || teacher.weeklyLessons || 17,
        };
        const remaining =
          load.remaining ?? Math.max(0, (load.effective || 0) - (load.current || 0));
        return {
          id: teacher._id,
          name: teacher.name,
          mainSubject:
            teacher.mainSubject?.name ||
            teacher.subjects?.[0]?.subjectId?.name ||
            "Không rõ môn",
          current: load.current || 0,
          effective: load.effective || 0,
          remaining,
          isOver: (load.current || 0) > (load.effective || 0),
        };
      });
  }, [teachers, teacherLoadMap]);

  // ✅ Load teacher status (chỉ lấy effective, không lấy current vì sẽ tính local)
  useEffect(() => {
    const fetchTeacherLoad = async () => {
      if (!filterYear) {
        setTeacherLoadMap({});
        return;
      }
      try {
        setTeacherLoadLoading(true);
        const response = await teacherApi.checkStatus({
          year: filterYear,
          semester: filterSemester,
        });
        const map: Record<string, { current: number; effective: number; remaining: number }> = {};
        response.teacherAnalysis?.forEach((item: any) => {
          const id = item.teacherId?._id?.toString?.() || item.teacherId?.toString?.() || item.teacherId;
          if (!id) return;
          // Chỉ lấy effective, current sẽ được tính local từ assignments
          const effective = item.effectiveWeeklyLessons || item.weeklyLessons || 17;
          map[id] = { current: 0, effective, remaining: effective };
        });
        setTeacherLoadMap(map);
      } catch (error) {
        console.error("Lỗi khi lấy tình trạng giáo viên:", error);
      } finally {
        setTeacherLoadLoading(false);
      }
    };

    fetchTeacherLoad();
  }, [filterYear, filterSemester]);

  // ✅ Load ClassPeriods để tính số tiết chính xác
  useEffect(() => {
    const loadClassPeriods = async () => {
      if (!filterYear || !filterSemester) {
        setClassPeriodsMap({});
        return;
      }
      try {
        const allClassPeriods = await classPeriodsApi.getClassPeriods({
          year: filterYear,
          semester: filterSemester,
        });
        
        const periodsMap: Record<string, number> = {};
        allClassPeriods.forEach((cp) => {
          Object.entries(cp.subjectPeriods || {}).forEach(([subjectId, periods]) => {
            const key = `${subjectId}_${cp.classId}`;
            periodsMap[key] = periods as number;
          });
        });
        setClassPeriodsMap(periodsMap);
      } catch (error) {
        console.error("Lỗi khi load ClassPeriods:", error);
      }
    };

    loadClassPeriods();
  }, [filterYear, filterSemester]);

  // ✅ Load proposals
  const loadProposals = async () => {
    try {
      setProposalsLoading(true);
      const data = await proposalApi.getAll({
        year: filterYear || currentYear || getCurrentSchoolYear(),
      });
      setProposals(data);
    } catch (error: any) {
      console.error("Lỗi khi tải đề xuất:", error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể tải danh sách đề xuất",
        variant: "destructive",
      });
    } finally {
      setProposalsLoading(false);
    }
  };

  // ✅ Filter proposals: chỉ hiển thị "pending" và "approved" trong dialog
  const filteredProposals = useMemo(() => {
    return proposals.filter(
      p => p.status === "pending" || p.status === "approved"
    );
  }, [proposals]);

  // ✅ Set form year khi currentYear thay đổi
  useEffect(() => {
    if (currentYear) {
      form.setValue("year", currentYear);
      setCheckYear(currentYear);
      // Tự động set năm học cho auto assign
      if (!autoYear) {
        setAutoYear(currentYear);
      }
    }
  }, [currentYear, form]);

  // ✅ Tự động kiểm tra thiếu giáo viên khi vào trang và auto-refresh
  useEffect(() => {
    const autoCheckMissing = async () => {
      if (!currentYear) return;
      
      try {
        setAutoCheckLoading(true);
        const result = await assignmentApi.checkMissingTeachers({
          year: currentYear,
          semester: "1", // Mặc định kiểm tra học kỳ 1
        });
        setAutoCheckData(result);
      } catch (error) {
        console.error("Lỗi khi tự động kiểm tra:", error);
        // Không hiển thị lỗi để không làm phiền người dùng
      } finally {
        setAutoCheckLoading(false);
      }
    };

    // Chỉ kiểm tra nếu có năm học và đã load xong dữ liệu
    if (currentYear && classes.length > 0 && teachers.length > 0) {
      // Kiểm tra ngay lập tức
      autoCheckMissing();
      
      // Tự động refresh mỗi 30 giây
      const interval = setInterval(() => {
        autoCheckMissing();
      }, 30000); // 30 giây
      
      // Cleanup interval khi component unmount hoặc dependencies thay đổi
      return () => clearInterval(interval);
    }
  }, [currentYear, classes.length, teachers.length, assignments.length]);




  // Thêm mới
  const handleSubmit = async (data: AssignmentFormData) => {
    try {
      const exists = assignments.some(
        (a) =>
          a.classId._id === data.classId &&
          a.subjectId._id === data.subjectId &&
          a.year === data.year &&
          a.semester === data.semester
      );

      if (exists) {
        alert("Môn học này đã được phân công cho lớp này trong học kỳ và năm học đó!");
        return;
      }

      const payload: TeachingAssignmentPayload = {
        teacherId: data.teacherId,
        subjectId: data.subjectId,
        classId: data.classId,
        semester: data.semester || filterSemester,
        year: data.year,
      };

      await createAssignment(payload);
      setOpen(false);
      form.reset({ year: filterYear || currentYear || getCurrentSchoolYear(), semester: filterSemester });
    } catch (err: any) {
      console.error("Lỗi khi phân công:", err);
      toast({
        title: "Lỗi",
        description: err?.response?.data?.error || err.message || "Có lỗi xảy ra khi tạo phân công",
        variant: "destructive",
      });
    }
  };
// 🔧 Lọc môn học khả dụng cho 1 lớp - năm học - học kỳ
const getAvailableSubjects = (classId: string, year: string, semester: string) => {
  // 1️⃣ Lọc ra các môn đã được phân công cho lớp đó, cùng năm học + học kỳ
  const assignedSubjectIds = assignments
    .filter(
      (a) =>
        a.classId._id === classId &&
        a.year === year &&
        a.semester === semester
    )
    .map((a) => a.subjectId._id);

  // 2️⃣ Lọc ra lớp tương ứng
  const classObj = classes.find((c) => c._id === classId);
  if (!classObj) return [];

  // 3️⃣ Lọc môn phù hợp với khối lớp, chưa được phân công
  return subjects.filter(
    (s) =>
      s.grades.includes(classObj.grade as any) &&
      !assignedSubjectIds.includes(s._id!)
  );
};



  // Delete
  const handleDelete = async (id: string) => {
    try {
      await removeAssignment(id);
    } catch (err) {
      console.error("Lỗi xóa phân công:", err);
      alert("Có lỗi xảy ra khi xóa phân công");
    }
  };

  // ✅ Hàm công bố phân công giảng dạy
  const handlePublishAssignments = async () => {
    if (!filterYear || !filterSemester) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn năm học và học kỳ",
        variant: "destructive",
      });
      return;
    }

    try {
      setPublishing(true);
      const result = await assignmentApi.publish({
        year: filterYear,
        semester: filterSemester,
      });
      
      toast({
        title: "✅ Thành công",
        description: result.message || `Đã công bố ${result.publishedCount} phân công giảng dạy`,
      });
      
      // Refresh danh sách assignments
      refetchAssignments();
    } catch (error: any) {
      console.error("❌ Lỗi khi công bố phân công:", error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể công bố phân công giảng dạy",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

const availableYears = useMemo(() => {
  const yearList = [
    ...schoolYears.map((y) => y.code),
    ...assignments.map((a) => a.year),
  ].filter(Boolean) as string[];
  return Array.from(new Set(yearList)).sort((a, b) => b.localeCompare(a));
}, [schoolYears, assignments]);
  
  // ✅ Set filterYear mặc định là năm học hiện tại khi có currentYear (bắt buộc)
useEffect(() => {
    if (currentYear && !filterYear) {
      setFilterYear(currentYear);
    }
  }, [currentYear, filterYear]);

// ✅ Chỉ lọc theo năm học (bắt buộc)
const filteredAssignments = useMemo(() => {
  if (!filterYear) return [];
  return assignments.filter(
    (a) =>
      a.year === filterYear &&
      (!filterSemester || a.semester === filterSemester)
  );
}, [assignments, filterYear, filterSemester]);

  // ✅ Kiểm tra số lượng điểm cho mỗi assignment
  useEffect(() => {
    if (!filterYear) return; // Đảm bảo filterYear đã được set
    
    // Lọc assignments theo filterYear và filterSemester
    const currentFiltered = assignments.filter(
      (a) =>
        a.year === filterYear &&
        (!filterSemester || a.semester === filterSemester)
    );
    
    if (currentFiltered.length === 0) return;
    
    const checkGradeCounts = async () => {
      const locks: Record<string, { gradeCount: number; locked: boolean }> = {};
      
      for (const assignment of currentFiltered) {
        if (assignment._id) {
          try {
            const result = await assignmentApi.getGradeCount(assignment._id);
            locks[assignment._id] = result;
          } catch (err) {
            console.error(`Error checking grade count for assignment ${assignment._id}:`, err);
            locks[assignment._id] = { gradeCount: 0, locked: false };
          }
        }
      }
      
      setAssignmentLocks(locks);
    };

    checkGradeCounts();
  }, [assignments, filterYear, filterSemester]);

// ✅ Tính toán số tiết giáo viên local dựa trên assignments hiện tại trong bảng
// Loại bỏ các giáo viên có flag BGH (isLeader)
const localTeacherLoadMapComputed = useMemo(() => {
  const localMap: Record<string, { current: number; effective: number; remaining: number }> = {};
  
  // Khởi tạo với effective từ teacherLoadMap hoặc từ teacher data
  // Chỉ tính cho giáo viên không phải BGH
  teachers
    .filter((teacher: any) => !teacher.teacherFlags?.isLeader) // Loại bỏ giáo viên BGH
    .forEach((teacher: any) => {
      const teacherIdStr = String(teacher._id);
      const effective = teacherLoadMap[teacherIdStr]?.effective || teacher.effectiveWeeklyLessons || teacher.weeklyLessons || 17;
      localMap[teacherIdStr] = {
        current: 0,
        effective,
        remaining: effective,
      };
    });

  // Tính số tiết đã phân công từ filteredAssignments
  // Chỉ tính cho giáo viên không phải BGH
  filteredAssignments.forEach((assignment) => {
    const teacherId = assignment.teacherId?._id || assignment.teacherId;
    if (!teacherId) return;

    // Kiểm tra xem giáo viên này có phải BGH không
    const teacher = teachers.find((t: any) => String(t._id) === String(teacherId));
    if ((teacher as any)?.teacherFlags?.isLeader) {
      return; // Bỏ qua giáo viên BGH
    }

    const teacherIdStr = String(teacherId);
    const subjectId = assignment.subjectId?._id || assignment.subjectId;
    const classId = assignment.classId?._id || assignment.classId;

    // Lấy số tiết từ classPeriodsMap hoặc tính mặc định
    const periodKey = `${subjectId}_${classId}`;
    let periods = classPeriodsMap[periodKey];
    
    // Nếu chưa có trong map, dùng giá trị mặc định dựa trên tên môn
    if (!periods) {
      const subject = subjects.find(s => String(s._id) === String(subjectId));
      if (subject) {
        const subjectName = subject.name.toLowerCase();
        const periodsMap: Record<string, number> = {
          toán: 4, "ngữ văn": 4, văn: 4,
          "tiếng anh": 3, anh: 3,
          "vật lý": 2, "hóa học": 2, hóa: 2,
          "sinh học": 2, sinh: 2,
          "lịch sử": 2, "địa lý": 2, địa: 2,
          "giáo dục công dân": 1, gdcd: 1,
          "thể dục": 2, "công nghệ": 1,
          "tin học": 1, tin: 1,
        };
        for (const [key, value] of Object.entries(periodsMap)) {
          if (subjectName.includes(key)) {
            periods = value;
            break;
          }
        }
        periods = periods || 2; // Default 2 tiết/tuần
      } else {
        periods = 2; // Default
      }
    }

    if (localMap[teacherIdStr]) {
      localMap[teacherIdStr].current += periods;
      localMap[teacherIdStr].remaining = Math.max(0, localMap[teacherIdStr].effective - localMap[teacherIdStr].current);
    }
  });

  return localMap;
}, [filteredAssignments, teachers, teacherLoadMap, classPeriodsMap, subjects]);

// ✅ Cập nhật teacherLoadList để sử dụng localTeacherLoadMap
// Loại bỏ các giáo viên có flag BGH (isLeader)
const updatedTeacherLoadListComputed = useMemo(() => {
  return teachers
    .filter((teacher: any) => !teacher.teacherFlags?.isLeader) // Loại bỏ giáo viên BGH
    .map((teacher: any) => {
      // Sử dụng localTeacherLoadMap thay vì teacherLoadMap
      const teacherIdStr = String(teacher._id);
      const load = localTeacherLoadMapComputed[teacherIdStr] || {
        current: 0,
        effective: teacher.effectiveWeeklyLessons || teacher.weeklyLessons || 17,
        remaining: teacher.effectiveWeeklyLessons || teacher.weeklyLessons || 17,
      };
      const remaining =
        load.remaining ?? Math.max(0, (load.effective || 0) - (load.current || 0));
      return {
        id: teacher._id,
        name: teacher.name,
        mainSubject:
          teacher.mainSubject?.name ||
          teacher.subjects?.[0]?.subjectId?.name ||
          "Không rõ môn",
        current: load.current || 0,
        effective: load.effective || 0,
        remaining,
        isOver: (load.current || 0) > (load.effective || 0),
      };
    });
}, [teachers, localTeacherLoadMapComputed]);

// ✅ Tính toán summary dựa trên updatedTeacherLoadListComputed (sau khi đã định nghĩa)
const teacherLoadSummary = useMemo(() => {
  // Sử dụng updatedTeacherLoadListComputed để tự động cập nhật khi thay đổi phân công
  const list = updatedTeacherLoadListComputed.length > 0 ? updatedTeacherLoadListComputed : teacherLoadList;
  const total = list.length;
  const overloaded = list.filter((t) => t.isOver).length;
  const available = list.filter((t) => t.remaining > 0 && !t.isOver).length;
  return { total, overloaded, available };
}, [updatedTeacherLoadListComputed, teacherLoadList]);


  // Inline update
//   const handleUpdate = async (id: string, field: "teacherId" | "subjectId" | "classId", value: string) => {
//     try {
//       const updated = await assignmentApi.update(id, { [field]: value });
//       setAssignments(prev => prev.map(a => (a._id === id ? updated : a)));
//     } catch (err) {
//       console.error("Lỗi cập nhật phân công:", err);
//     }
//   };
// Inline update
const handleUpdate = async (
  id: string,
  field: "teacherId" | "subjectId",
  value: string
) => {
  const current = assignments.find(a => a._id === id);
  if (!current) return;

  // Nếu là update teacher hoặc teacher đã được chọn → gọi API
  // Hook sẽ tự động refetch sau khi update
  if (field === "teacherId" || (field === "subjectId" && current.teacherId._id)) {
    try {
      const payload: TeachingAssignmentPayload = {
        teacherId: field === "teacherId" ? value : current.teacherId._id,
        subjectId: field === "subjectId" ? value : current.subjectId._id,
        classId: current.classId._id,
        year: current.year,
        semester: current.semester,
      };
      await updateAssignment({ id, data: payload });
    } catch (err) {
      console.error("Lỗi cập nhật phân công:", err);
      alert("Có lỗi xảy ra khi cập nhật phân công");
    }
  }
};


// Helper lọc giáo viên theo môn
// Helper lọc giáo viên theo môn + đúng khối lớp (loại bỏ BGH)
const getAvailableTeachers = (subjectId?: string, classGrade?: string) => {
  if (!subjectId || !classGrade) return [];
  return teachers.filter(t =>
    !t.isLeader && // ✅ Loại bỏ giáo viên BGH
    t.subjects?.some(
      s => s.subjectId._id === subjectId && s.grades.includes(classGrade as any)
    )
  );
};

const handleConfirmAutoAssign = async () => {
  try {
    // ✅ Validation
    if (!autoYear) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn năm học.",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedGrades.length === 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất một khối.",
        variant: "destructive",
      });
      return;
    }
    
    // ✅ Kiểm tra có lớp nào cho năm học và khối đã chọn không
    const availableClasses = classes.filter(c => 
      selectedGrades.includes(String(c.grade)) && c.year === autoYear
    );
    
    if (availableClasses.length === 0) {
      toast({
        title: "Cảnh báo",
        description: `Không có lớp nào cho năm học ${autoYear} và khối ${selectedGrades.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    
    // ✅ Kiểm tra có giáo viên nào phù hợp không
    const availableTeachers = teachers.filter(t => 
      !t.isLeader && // Loại bỏ BGH
      t.status === 'active' && // Chỉ giáo viên đang làm việc
      t.subjects && t.subjects.length > 0 // Có môn dạy
    );
    
    if (availableTeachers.length === 0) {
      toast({
        title: "Cảnh báo",
        description: "Không có giáo viên nào phù hợp để phân công (đã loại bỏ BGH và giáo viên đã nghỉ việc).",
        variant: "destructive",
      });
      return;
    }

    // ✅ Kiểm tra xem đã có phân công cho năm học + học kỳ + khối này chưa
    const existingAssignmentsForYearSemester = assignments.filter(
      a => a.year === autoYear && a.semester === autoSemester
    );

    // Lấy danh sách lớp của các khối được chọn
    const targetClasses = classes.filter(c => 
      selectedGrades.includes(String(c.grade)) && c.year === autoYear
    );
    const targetClassIds = new Set(targetClasses.map(c => c._id));

    // Kiểm tra xem có phân công nào cho các lớp này không
    const hasExistingAssignments = existingAssignmentsForYearSemester.some(
      a => targetClassIds.has(a.classId._id)
    );

    let shouldDeleteOld = false;
    let shouldSupplement = false;

    // ✅ Nếu đã có phân công, hiển thị dialog để hỏi người dùng
    if (hasExistingAssignments) {
      setConfirmAutoAssignDialog(true);
      return; // Chờ người dùng chọn
    }

    // ✅ Nếu chưa có phân công, tiếp tục tạo mới
    await executeAutoAssign(false, false);
  } catch (error) {
    console.error("❌ Lỗi phân công tự động:", error);
    toast({
      title: "Lỗi",
      description: "Có lỗi xảy ra khi phân công tự động.",
      variant: "destructive",
    });
  }
};

// ✅ Hàm thực thi phân công tự động (gọi API backend)
const executeAutoAssign = async (shouldDeleteOld: boolean, shouldSupplement: boolean) => {
  try {
    setAutoAssignLoading(true);
    setConfirmAutoAssignDialog(false);

    // ✅ Gọi API backend để phân công tự động
    const result = await assignmentApi.autoAssign({
      year: autoYear,
      semester: autoSemester,
      grades: selectedGrades,
      shouldDeleteOld,
      shouldSupplement,
    });

    toast({
      title: "Thành công",
      description: result.message || `Đã ${shouldDeleteOld ? 'xóa phân công cũ và ' : shouldSupplement ? 'bổ sung ' : ''}phân công tự động ${result.createdCount} môn/lớp cho năm ${autoYear}, học kỳ ${autoSemester}, khối ${selectedGrades.join(", ")}!`,
    });
    
    setAutoAssignOpen(false);
    
    // ✅ Refresh danh sách phân công
    await refetchAssignments();
  } catch (error: any) {
    console.error("❌ Lỗi phân công tự động:", error);
    toast({
      title: "Lỗi",
      description: error.response?.data?.message || error.message || "Có lỗi xảy ra khi phân công tự động.",
      variant: "destructive",
    });
  } finally {
    setAutoAssignLoading(false);
    setDeleteProgress({ current: 0, total: 0 });
  }
};

// ✅ Hàm kiểm tra môn thiếu giáo viên
const handleCheckMissingTeachers = async () => {
  try {
    setCheckMissingLoading(true);
    const params: any = {
      year: checkYear,
      semester: checkSemester,
    };
    if (checkGrade !== "all") {
      params.grade = checkGrade;
    }

    const result = await assignmentApi.checkMissingTeachers(params);
    setMissingTeachersData(result);
  } catch (error: any) {
    console.error("❌ Lỗi khi kiểm tra môn thiếu giáo viên:", error);
    toast({
      title: "Lỗi",
      description: error.response?.data?.error || "Không thể kiểm tra môn thiếu giáo viên",
      variant: "destructive",
    });
  } finally {
    setCheckMissingLoading(false);
  }
};

  // Filter
  // const filteredAssignments = useMemo(() => {
  //   if (!searchTerm) return assignments;
  //   return assignments.filter(a =>
  //     a.teacherId?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     a.classId?.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     a.subjectId?.name.toLowerCase().includes(searchTerm.toLowerCase())
  //   );
  // }, [assignments, searchTerm]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Phân công giảng dạy</h2>
          <p className="text-muted-foreground mt-1">
            Quản lý phân công giảng dạy cho giáo viên
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}>+ Thêm phân công</Button>
          <Button variant="secondary" onClick={() => setAutoAssignOpen(true)}>🤖 Phân công tự động</Button>
          {isDepartmentHead && (
            <Button 
              variant="outline" 
              onClick={async () => {
                setProposalsOpen(true);
                await loadProposals();
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Xem đề xuất
            </Button>
          )}
          <Button variant="outline" onClick={() => {
            setCheckYear(currentYear || getCurrentSchoolYear());
            setCheckSemester("1");
            setCheckGrade("all");
            setCheckMissingOpen(true);
          }}>
            <Search className="h-4 w-4 mr-2" />
            Kiểm tra môn thiếu giáo viên
          </Button>
          {filterYear && filterSemester && (
            <Button 
              variant="default" 
              onClick={handlePublishAssignments}
              disabled={publishing}
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang công bố...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Công bố phân công
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ✅ Card tình trạng số tiết giáo viên */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Tình trạng số tiết giáo viên</CardTitle>
            <p className="text-sm text-muted-foreground">
              Năm {filterYear || currentYear || getCurrentSchoolYear()} • Học kỳ {filterSemester}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={teacherLoadSummary.overloaded > 0 ? "destructive" : "secondary"}>
              Quá tải: {teacherLoadSummary.overloaded}/{teacherLoadSummary.total}
            </Badge>
            <Badge variant="outline">
              Còn tiết: {teacherLoadSummary.available}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowTeacherLoadCard((prev) => !prev)}
            >
              {showTeacherLoadCard ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showTeacherLoadCard && (
          <CardContent>
            {teacherLoadLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : updatedTeacherLoadListComputed.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Chưa có dữ liệu số tiết giáo viên
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                  {updatedTeacherLoadListComputed
                    .sort((a, b) => b.current - a.current)
                    .map((teacher) => (
                      <div
                        key={teacher.id}
                        className={`p-3 rounded-lg border ${
                          teacher.isOver
                            ? "border-destructive/50 bg-destructive/5"
                            : teacher.remaining <= 3
                            ? "border-orange-300 bg-orange-50"
                            : "border-muted-foreground/20 bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{teacher.name}</p>
                          <Badge
                            variant={teacher.isOver ? "destructive" : "secondary"}
                            className="text-[11px]"
                          >
                            {teacher.current}/{teacher.effective} tiết
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{teacher.mainSubject}</p>
                        <p
                          className={`text-xs font-semibold mt-1 ${
                            teacher.isOver ? "text-destructive" : "text-emerald-600"
                          }`}
                        >
                          {teacher.isOver
                            ? "Đã vượt số tiết"
                            : `Còn ${teacher.remaining} tiết`}
                        </p>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  * Dữ liệu tự động cập nhật khi thay đổi phân công trong học kỳ hiện tại.
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

{/* ✅ Card tự động kiểm tra thiếu giáo viên */}
{(autoCheckData || autoCheckLoading) && showAutoCheckCard && (
        <Card className={`border-2 ${
          autoCheckData?.summary.totalMissing > 0 
            ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/30 shadow-lg' 
            : 'border-green-300 bg-green-50 dark:bg-green-900/20'
        }`}>
          <CardContent className="p-5">
      <div className="flex justify-end mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowAutoCheckCard(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                {autoCheckLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary mt-0.5" />
                ) : autoCheckData?.summary.totalMissing > 0 ? (
                  <AlertTriangle className="h-6 w-6 text-orange-600 mt-0.5" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className={`font-bold text-lg ${
                    autoCheckData?.summary.totalMissing > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-green-700 dark:text-green-400'
                  }`}>
                    {autoCheckLoading 
                      ? "Đang kiểm tra môn thiếu giáo viên..." 
                      : autoCheckData?.summary.totalMissing > 0
                      ? `⚠️ Phát hiện ${autoCheckData.summary.totalMissing} lớp/môn thiếu giáo viên`
                      : "✅ Tất cả các lớp đã có giáo viên được phân công"}
                  </h3>
                  {autoCheckData && !autoCheckLoading && (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Năm học <strong>{autoCheckData.filters?.year || currentYear}</strong> - Học kỳ{" "}
                        <strong>{autoCheckData.filters?.semester || "1"}</strong> | 
                        Tổng <strong>{autoCheckData.summary.totalClasses}</strong> lớp
                        {autoCheckData.summary.totalMissing > 0 && (
                          <> | <span className="text-orange-600 font-bold text-base">{autoCheckData.summary.totalMissing} lớp/môn thiếu</span></>
                        )}
                      </p>

                      {/* Thống kê theo khối */}
                      {autoCheckData.summary.totalMissing > 0 && (
                        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                          <p className="text-sm font-medium mb-2">Thống kê theo khối:</p>
                          <div className="grid grid-cols-3 gap-3">
                            {["10", "11", "12"].map((grade) => {
                              const gradeClasses = classes.filter(c => c.grade === grade && c.year === currentYear);
                              const gradeMissing = autoCheckData.missingAssignments.filter(
                                (m: any) => m.grade === grade
                              ).length;
                              const percentage = gradeClasses.length > 0 
                                ? Math.round((gradeMissing / gradeClasses.length) * 100) 
                                : 0;
                              
                              return (
                                <div key={grade} className="text-center p-2 bg-muted rounded">
                                  <p className="text-xs text-muted-foreground">Khối {grade}</p>
                                  <p className="text-lg font-bold text-orange-600">{gradeMissing}</p>
                                  <p className="text-xs text-muted-foreground">
                                    / {gradeClasses.length} lớp ({percentage}%)
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Hiển thị thống kê nhanh theo môn - Cải thiện cho số lượng lớn */}
                      {autoCheckData.summary.totalMissing > 0 && autoCheckData.summary.bySubject.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Môn học thiếu giáo viên:</p>
                            <Badge variant="destructive" className="text-xs">
                              {autoCheckData.summary.bySubject.length} môn
                            </Badge>
                          </div>
                          <div className="max-h-[120px] overflow-y-auto border rounded-lg p-2 bg-white dark:bg-gray-800">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {autoCheckData.summary.bySubject
                                .sort((a: any, b: any) => b.missingClassesCount - a.missingClassesCount)
                                .map((subject: any) => (
                                <div key={subject.subjectId} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200">
                                  <span className="text-xs font-medium truncate flex-1">{subject.subjectName}</span>
                                  <Badge variant="destructive" className="text-xs ml-1">
                                    {subject.missingClassesCount}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {autoCheckData && autoCheckData.summary.totalMissing > 0 && (
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setCheckYear(currentYear);
                      setCheckSemester("1");
                      setCheckGrade("all");
                      setMissingTeachersData(autoCheckData);
                      setCheckMissingOpen(true);
                    }}
                    className="w-full"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Xem chi tiết đầy đủ
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setAutoAssignOpen(true)}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    🤖 Phân công tự động
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    Hệ thống sẽ tự động gán giáo viên phù hợp
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
{(autoCheckData || autoCheckLoading) && !showAutoCheckCard && (
  <div className="flex justify-end">
    <Button variant="outline" size="sm" onClick={() => setShowAutoCheckCard(true)}>
      Hiển thị cảnh báo thiếu giáo viên
    </Button>
  </div>
)}

      {/* ✅ Nút xóa tất cả phân công theo năm học */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Xóa phân công theo năm học</h3>
              <p className="text-sm text-muted-foreground">
                Xóa tất cả phân công giảng dạy của một năm học và học kỳ
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteYearInput({ year: "", semester: "" });
                setDeleteYearDialog(true);
              }}
            >
              🗑️ Xóa phân công theo năm học
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card chứa danh sách phân công */}
      <Card>
        <CardHeader className="flex flex-col items-start gap-4">
          <div className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Danh sách phân công giảng dạy
            </CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadProposals();
                  setProposalsOpen(true);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Xem đề xuất
              </Button>
              <Badge variant="secondary" className="text-sm">
                {filteredAssignments.length} / {assignments.length} phân công
              </Badge>
            </div>
          </div>

          {/* Bộ lọc - Chỉ lọc theo năm học (bắt buộc) */}
          <div className="flex flex-wrap gap-4 items-center w-full">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Năm học:</label>
              <Select 
                value={filterYear || ""} 
                onValueChange={setFilterYear}
                disabled={!availableYears.length}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Chọn năm học (bắt buộc)" />
    </SelectTrigger>
    <SelectContent>
      {availableYears.map(y => (
                    <SelectItem key={y} value={y}>
                      {y} {y === currentYear ? "(Năm học hiện tại)" : ""}
                    </SelectItem>
      ))}
    </SelectContent>
  </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Học kỳ:</label>
              <Select 
                value={filterSemester}
                onValueChange={(value) => setFilterSemester(value as "1" | "2")}
              >
                <SelectTrigger className="w-[160px]">
      <SelectValue placeholder="Chọn học kỳ" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="1">Học kỳ 1</SelectItem>
      <SelectItem value="2">Học kỳ 2</SelectItem>
    </SelectContent>
  </Select>
            </div>

            {!filterYear && (
              <Badge variant="destructive" className="text-xs">
                Vui lòng chọn năm học
              </Badge>
        )}
        </div>
        </CardHeader>
        
        <CardContent>
      {/* ✅ 3 Bảng dọc theo khối */}
          <div className="space-y-8">
            {(["10", "11", "12"] as const).map((grade) => {
              // Lọc classes theo khối và năm học
              const gradeClasses = useMemo(() => {
                if (!filterYear) return [];
                return classes
                  .filter(c => c.grade === grade && c.year === filterYear)
                  .sort((a, b) => a.className.localeCompare(b.className));
              }, [classes, grade, filterYear]);

              // Lọc subjects theo khối
              const gradeSubjects = useMemo(() => {
                return subjects
                  .filter(s => s.grades.includes(grade as any))
                  .sort((a, b) => a.name.localeCompare(b.name));
              }, [subjects, grade]);

              // Helper: Lấy assignment cho môn + lớp (chỉ lọc theo năm học)
              const getAssignment = (subjectId: string, classId: string) => {
                if (!filterYear) return undefined;
                return assignments.find(
                  (a) =>
                    a.subjectId._id === subjectId &&
                    a.classId._id === classId &&
                    a.year === filterYear &&
                    (!filterSemester || a.semester === filterSemester)
                );
              };

              // Helper: Xóa tất cả assignments của một môn
              const handleDeleteSubject = async (subjectId: string) => {
                if (!filterYear) {
                  toast({
                    title: "Lỗi",
                    description: "Vui lòng chọn năm học",
                    variant: "destructive",
                  });
                  return;
                }
                const assignmentsToDelete = assignments.filter(
                  (a) =>
                    a.subjectId._id === subjectId &&
                    gradeClasses.some((c) => c._id === a.classId._id) &&
                    a.year === filterYear &&
                    (!filterSemester || a.semester === filterSemester)
                );
                
                if (assignmentsToDelete.length === 0) {
                  toast({
                    title: "Thông báo",
                    description: "Không có phân công nào để xóa",
                  });
                  return;
                }

                if (!confirm(`Bạn có chắc muốn xóa ${assignmentsToDelete.length} phân công của môn này?`)) {
                  return;
                }

                try {
                  for (const assignment of assignmentsToDelete) {
                    await removeAssignment(assignment._id);
                  }
                  toast({
                    title: "Thành công",
                    description: `Đã xóa ${assignmentsToDelete.length} phân công`,
                  });
                } catch (err) {
                  console.error("Lỗi xóa phân công:", err);
                  toast({
                    title: "Lỗi",
                    description: "Có lỗi xảy ra khi xóa phân công",
                    variant: "destructive",
                  });
                }
              };

              // Helper: Tạo hoặc cập nhật assignment
              const handleCellChange = async (subjectId: string, classId: string, teacherId: string) => {
                if (!filterYear) {
                  toast({
                    title: "Lỗi",
                    description: "Vui lòng chọn năm học",
                    variant: "destructive",
                  });
                  return;
                }
                
                // ✅ Đảm bảo tất cả ID là string
                const subjectIdStr = typeof subjectId === 'object' ? (subjectId as any)?._id || String(subjectId) : String(subjectId);
                const classIdStr = typeof classId === 'object' ? (classId as any)?._id || String(classId) : String(classId);
                const teacherIdStr = typeof teacherId === 'object' ? (teacherId as any)?._id || String(teacherId) : String(teacherId);
                
                const existing = getAssignment(subjectIdStr, classIdStr);
                const classObj = classes.find(c => String(c._id) === classIdStr);
                const year = filterYear;
                const semester: "1" | "2" = filterSemester || "1";

                if (existing) {
                  // Update
                  try {
                    const payload: TeachingAssignmentPayload = {
                      teacherId: teacherIdStr,
                      subjectId: subjectIdStr,
                      classId: classIdStr,
                      year,
                      semester,
                    };
                    await updateAssignment({ id: existing._id, data: payload });
                    toast({
                      title: "Thành công",
                      description: "Đã cập nhật phân công",
                    });
                    refetchAssignments();
                  } catch (err: any) {
                    console.error("Lỗi cập nhật phân công:", err);
                    toast({
                      title: "Lỗi",
                      description: err.response?.data?.error || err.message || "Có lỗi xảy ra khi cập nhật phân công",
                      variant: "destructive",
                    });
                  }
                } else {
                  // Create
                  try {
                    const payload: TeachingAssignmentPayload = {
                      teacherId: teacherIdStr,
                      subjectId: subjectIdStr,
                      classId: classIdStr,
                      year,
                      semester,
                    };
                    await createAssignment(payload);
                    toast({
                      title: "Thành công",
                      description: "Đã tạo phân công",
                    });
                    refetchAssignments();
                  } catch (err: any) {
                    console.error("Lỗi tạo phân công:", err);
                    toast({
                      title: "Lỗi",
                      description: err.response?.data?.error || err.message || "Có lỗi xảy ra khi tạo phân công",
                      variant: "destructive",
                    });
                  }
                }
              };

              if (gradeClasses.length === 0) return null;

              return (
                <div key={grade} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-primary">Khối {grade}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {gradeClasses.length} lớp
                    </Badge>
                  </div>
                  <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-0">
                            <TableHead className="bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 min-w-[70px] text-center font-bold text-primary shadow-sm">
                              <div className="py-1">STT</div>
                            </TableHead>
                            <TableHead className="bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 min-w-[180px] font-bold text-primary shadow-sm">
                              <div className="py-1">Môn / Xóa</div>
                            </TableHead>
                            {gradeClasses.map(cls => (
                              <TableHead 
                                key={cls._id} 
                                className="min-w-[160px] font-bold text-center bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 text-primary dark:text-primary shadow-sm"
                              >
                                <div className="py-1">
                                  {cls.className}
                                </div>
                              </TableHead>
                            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
                          {gradeSubjects.length > 0 ? (
                            gradeSubjects.map((subject, index) => {
                              const availableTeachersForSubject = getAvailableTeachers(subject._id!, grade);
                              
                              return (
                                <TableRow 
                                  key={subject._id}
                                  className="hover:bg-muted/30 transition-colors border-0"
                                >
                                  <TableCell className="bg-primary/10 dark:bg-primary/20 text-center font-semibold text-primary">
                                    <span className="text-base">{index + 1}</span>
                </TableCell>
                                  <TableCell className="bg-primary/10 dark:bg-primary/20">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-sm">{subject.name}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive-foreground hover:bg-destructive shrink-0"
                                        onClick={() => handleDeleteSubject(subject._id!)}
                                        title="Xóa tất cả phân công của môn này"
                                        disabled={gradeSubjects.some(s => {
                                          const assignment = getAssignment(s._id!, gradeClasses[0]?._id);
                                          return assignment?._id && assignmentLocks[assignment._id]?.locked;
                                        })}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  {gradeClasses.map(cls => {
                                    const cellAssignment = getAssignment(subject._id!, cls._id);
                                    const hasTeacher = !!cellAssignment?.teacherId?._id;
                                    const isLocked = cellAssignment?._id ? assignmentLocks[cellAssignment._id]?.locked || false : false;
                                    const gradeCount = cellAssignment?._id ? assignmentLocks[cellAssignment._id]?.gradeCount || 0 : 0;
                                    
                                    // Tính số tiết cho lớp này
                                    const periodKey = `${subject._id}_${cls._id}`;
                                    const periodsForThisClass = classPeriodsMap[periodKey] || (() => {
                                      // Nếu chưa có trong map, tính mặc định
                                      const subjectName = subject.name.toLowerCase();
                                      const periodsMap: Record<string, number> = {
                                        toán: 4, "ngữ văn": 4, văn: 4,
                                        "tiếng anh": 3, anh: 3,
                                        "vật lý": 2, "hóa học": 2, hóa: 2,
                                        "sinh học": 2, sinh: 2,
                                        "lịch sử": 2, "địa lý": 2, địa: 2,
                                        "giáo dục công dân": 1, gdcd: 1,
                                        "thể dục": 2, "công nghệ": 1,
                                        "tin học": 1, tin: 1,
                                      };
                                      for (const [key, value] of Object.entries(periodsMap)) {
                                        if (subjectName.includes(key)) return value;
                                      }
                                      return 2; // Default
                                    })();
                                    
                                    // Tính số tiết còn lại cho từng giáo viên (giống ProposalsPage)
                                    const teachersWithRemaining = availableTeachersForSubject.map(teacher => {
                                      const teacherIdStr = String(teacher._id);
                                      const teacherLoad = teacherLoadMap[teacherIdStr] || { 
                                        current: 0, 
                                        effective: teacher.effectiveWeeklyLessons || teacher.weeklyLessons || 17, 
                                        remaining: teacher.effectiveWeeklyLessons || teacher.weeklyLessons || 17 
                                      };
                                      
                                      // Tính tổng số tiết đã được phân công trong filteredAssignments (trừ assignment hiện tại nếu đang edit)
                                      const totalSelectedPeriods = filteredAssignments
                                        .filter(a => {
                                          const aTeacherId = a.teacherId?._id || a.teacherId;
                                          const aSubjectId = a.subjectId?._id || a.subjectId;
                                          const aClassId = a.classId?._id || a.classId;
                                          
                                          // Bỏ qua assignment hiện tại nếu đang edit
                                          if (cellAssignment && cellAssignment._id === a._id) {
                                            return false;
                                          }
                                          
                                          return String(aTeacherId) === teacherIdStr;
                                        })
                                        .reduce((sum, assignment) => {
                                          const aSubjectId = assignment.subjectId?._id || assignment.subjectId;
                                          const aClassId = assignment.classId?._id || assignment.classId;
                                          const pKey = `${aSubjectId}_${aClassId}`;
                                          const periods = classPeriodsMap[pKey] || (() => {
                                            const sub = subjects.find(s => s._id === aSubjectId);
                                            if (sub) {
                                              const subName = sub.name.toLowerCase();
                                              const periodsMap: Record<string, number> = {
                                                toán: 4, "ngữ văn": 4, văn: 4,
                                                "tiếng anh": 3, anh: 3,
                                                "vật lý": 2, "hóa học": 2, hóa: 2,
                                                "sinh học": 2, sinh: 2,
                                                "lịch sử": 2, "địa lý": 2, địa: 2,
                                                "giáo dục công dân": 1, gdcd: 1,
                                                "thể dục": 2, "công nghệ": 1,
                                                "tin học": 1, tin: 1,
                                              };
                                              for (const [key, value] of Object.entries(periodsMap)) {
                                                if (subName.includes(key)) return value;
                                              }
                                            }
                                            return 2;
                                          })();
                                          return sum + periods;
                                        }, 0);
                                      
                                      const remaining = teacherLoad.remaining - totalSelectedPeriods;
                                      
                                      return {
                                        ...teacher,
                                        remaining: Math.max(0, remaining),
                                        canAssign: remaining >= periodsForThisClass,
                                        current: teacherLoad.current + totalSelectedPeriods,
                                        effective: teacherLoad.effective,
                                      };
                                    });
                                    
                                    return (
                                      <TableCell 
                                        key={cls._id}
                                        className={`${hasTeacher ? "bg-primary/5" : "bg-orange-50/50 dark:bg-orange-900/10"} transition-colors`}
                                      >
    <div className="relative">
                                            {isLocked && (
                                              <div className="absolute -top-1 -right-1 z-10 bg-yellow-500 text-white rounded-full p-1 shadow-md" title={`Đã có ${gradeCount} điểm - Không thể thay đổi`}>
                                                <Lock className="h-3 w-3" />
                                              </div>
                                            )}
                                            {cellAssignment?.isPublished && (
                                              <div className="absolute -top-1 -left-1 z-10 bg-green-500 text-white rounded-full p-1 shadow-md" title="Đã công bố cho giáo viên">
                                                <CheckCircle className="h-3 w-3" />
                                              </div>
                                            )}
                                            <Select
                                              value={cellAssignment?.teacherId?._id || ""}
                                              onValueChange={(teacherId) => {
                                                if (teacherId && !isLocked) {
                                                  const subjectId = String(subject._id);
                                                  const classId = String(cls._id);
                                                  handleCellChange(subjectId, classId, teacherId);
                                                }
                                              }}
                                              disabled={isLocked}
                                            >
                                              <SelectTrigger className={`w-full h-9 ${hasTeacher ? "border-primary/50 bg-primary/5 hover:bg-primary/10" : "border-orange-200 dark:border-orange-800 hover:bg-orange-100/50 dark:hover:bg-orange-900/20"} ${isLocked ? "opacity-60 cursor-not-allowed" : ""} transition-colors`}>
                                            <SelectValue placeholder="Chọn giáo viên">
                                              {cellAssignment?.teacherId?.name ? (
                                                <>
                                                  {cellAssignment.teacherId.name}
                                                  {(() => {
                                                    const teacherIdStr = String(cellAssignment.teacherId._id);
                                                    const teacherInfo = teachersWithRemaining.find(t => String(t._id) === teacherIdStr);
                                                    if (teacherInfo) {
                                                      return (
                                                        <span className="ml-2 text-xs text-muted-foreground">
                                                          {teacherInfo.current}/{teacherInfo.effective} tiết
                                                        </span>
                                                      );
                                                    }
                                                    return null;
                                                  })()}
                                                </>
                                              ) : (
                                                <span className="text-muted-foreground">Chọn giáo viên</span>
                                              )}
                                            </SelectValue>
                                              </SelectTrigger>
                                              <SelectContent>
                                            {teacherLoadLoading && (
                                              <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Đang tải tình trạng giáo viên...
                                              </div>
                                            )}
                                            {teachersWithRemaining.length > 0 ? (
                                              teachersWithRemaining.map(teacher => {
                                                const isOver = teacher.current >= teacher.effective;
                                                return (
                                                  <SelectItem 
                                                    key={teacher._id} 
                                                    value={teacher._id}
                                                    disabled={!teacher.canAssign}
                                                  >
                                                    <div className="flex flex-col space-y-1">
                                                      <span className="font-medium flex items-center justify-between gap-2">
                                                        {teacher.name}
                                                        <span className={`text-xs font-semibold ${isOver ? "text-destructive" : "text-emerald-600"}`}>
                                                          {teacher.current}/{teacher.effective} tiết
                                                        </span>
                                                      </span>
                                                      <span className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                                                        {teacher.mainSubject?.name || teacher.subjects?.[0]?.subjectId?.name || "Không rõ môn"}
                                                        <span className={teacher.remaining < periodsForThisClass ? "text-destructive" : "text-primary"}>
                                                          Còn {teacher.remaining} tiết
                                                        </span>
                                                      </span>
                                                    </div>
          </SelectItem>
                                                );
                                              })
      ) : (
                                              <div className="p-2 text-sm text-muted-foreground text-center">
                                                Không có giáo viên
        </div>
      )}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                      </TableCell>
                                    );
                                  })}
              </TableRow>
                              );
                            })
          ) : (
            <TableRow>
                              <TableCell colSpan={gradeClasses.length + 2} className="text-center text-muted-foreground py-8">
                                <div className="flex flex-col items-center gap-2">
                                  <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                                  <span>Không có môn học nào cho khối {grade}</span>
                                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
          </div>
          </div>
                </div>
                );
              })}
            </div>
        </CardContent>
      </Card>

      {/* Dialog Thêm phân công */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm phân công giảng dạy</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} noValidate  className="space-y-4">
              {/* Chọn lớp */}
<FormField
  control={form.control}
  name="classId"
  render={({ field }) => {
    // Năm học hiện tại đang được chọn trong form
    const selectedYear = form.watch("year");

    // ✅ Lọc lớp theo năm học được chọn (bắt buộc phải có năm học)
    // ✅ Chỉ hiển thị lớp của năm học được chọn để tránh trùng lặp
    const availableClasses = selectedYear
      ? classes
          .filter((c) => c.year === selectedYear)
          .sort((a, b) => {
            // Sắp xếp theo khối trước, sau đó theo tên lớp
            if (a.grade !== b.grade) {
              return Number(a.grade) - Number(b.grade);
            }
            return (a.className || '').localeCompare(b.className || '');
          })
      : [];

    return (
      <FormItem>
        <FormLabel>Lớp</FormLabel>
        <FormControl>
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger>
              <SelectValue placeholder={selectedYear ? `Chọn lớp (${selectedYear})` : "Chọn lớp"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {availableClasses.length > 0 ? (
                availableClasses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.className}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-sm text-muted-foreground">
                  {selectedYear 
                    ? `Không có lớp nào cho năm ${selectedYear}. Vui lòng chọn năm học trước.` 
                    : 'Vui lòng chọn năm học trước'}
                </div>
              )}
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }}
/>


              {/* Chọn môn học */}
<FormField
  control={form.control}
  name="subjectId"
  render={({ field }) => {
    const selectedClassId = form.watch("classId");
    const selectedYear = form.watch("year");
    const selectedSemester = form.watch("semester");
    const selectedClass = classes.find((c) => c._id === selectedClassId);

    const availableSubjects =
      selectedClass && selectedYear && selectedSemester
        ? getAvailableSubjects(selectedClass._id, selectedYear, selectedSemester)
        : [];

    return (
      <FormItem>
        <FormLabel>Môn học</FormLabel>
        <FormControl>
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn môn học" />
            </SelectTrigger>
            <SelectContent>
              {selectedClass ? (
                availableSubjects.length > 0 ? (
                  availableSubjects.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    Không có môn học nào khả dụng cho lớp này
                  </div>
                )
              ) : (
                <div className="p-2 text-sm text-muted-foreground">
                  Hãy chọn lớp trước
                </div>
              )}
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }}
/>


              {/* Chọn giáo viên */}
             <FormField
  control={form.control}
  name="teacherId"
  render={({ field }) => {
    const selectedSubjectId = form.watch("subjectId");
    const selectedClassId = form.watch("classId");
    const selectedClass = classes.find(c => c._id === selectedClassId);

    const availableTeachers = selectedSubjectId && selectedClass
      ? teachers.filter(t =>
          t.subjects?.some(
            s =>
              s.subjectId._id === selectedSubjectId &&
              s.grades.includes(selectedClass.grade as any)
          )
        )
      : [];

    return (
      <FormItem>
        <FormLabel>Giáo viên</FormLabel>
        <FormControl>
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger><SelectValue placeholder="Chọn giáo viên" /></SelectTrigger>
            <SelectContent>
              {selectedSubjectId && selectedClass ? (
                availableTeachers.length > 0 ? (
                  availableTeachers.map(t => (
                    <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    Không có giáo viên dạy môn này cho khối {selectedClass.grade}
                  </div>
                )
              ) : (
                <div className="p-2 text-sm text-muted-foreground">
                  Hãy chọn lớp và môn học trước
                </div>
              )}
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }}
/>


              {/* Học kỳ */}
              <FormField
                control={form.control}
                name="semester"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Học kỳ</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn học kỳ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Học kỳ 1</SelectItem>
                          <SelectItem value="2">Học kỳ 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Năm học */}
<FormField
  control={form.control}
  name="year"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Năm học</FormLabel>
      <FormControl>
        <Select
          value={field.value || currentYear}
          onValueChange={field.onChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn năm học" />
          </SelectTrigger>
          <SelectContent>
            {schoolYears.map((y) => (
              <SelectItem key={y.code} value={y.code}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>


              <DialogFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
                <Button type="submit">Lưu</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* ✅ Dialog xác nhận phân công tự động khi đã có phân công */}
      <Dialog open={confirmAutoAssignDialog} onOpenChange={setConfirmAutoAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận phân công tự động</DialogTitle>
            <DialogDescription>
              Đã có phân công cho năm {autoYear}, học kỳ {autoSemester}, khối {selectedGrades.join(", ")}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Bạn muốn:
            </p>
            <div className="space-y-2">
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => executeAutoAssign(true, false)}
                disabled={autoAssignLoading}
              >
                Xóa phân công cũ và tạo mới
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => executeAutoAssign(false, true)}
                disabled={autoAssignLoading}
              >
                Bổ sung phân công mới (chỉ thêm lớp chưa có phân công)
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAutoAssignDialog(false)} disabled={autoAssignLoading}>
              Hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ Dialog xóa phân công theo năm học */}
      <Dialog open={deleteYearDialog} onOpenChange={setDeleteYearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa phân công theo năm học</DialogTitle>
            <DialogDescription>
              Nhập thông tin năm học và học kỳ cần xóa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Năm học</label>
              <Input
                placeholder="VD: 2024-2025"
                value={deleteYearInput.year}
                onChange={(e) => setDeleteYearInput({ ...deleteYearInput, year: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Học kỳ (để trống để xóa cả 2 học kỳ)</label>
              <Select
                value={deleteYearInput.semester}
                onValueChange={(v) => setDeleteYearInput({ ...deleteYearInput, semester: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn học kỳ (tùy chọn)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả học kỳ</SelectItem>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteYearDialog(false)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteYearInput.year) {
                  toast({
                    title: "Lỗi",
                    description: "Vui lòng nhập năm học.",
                    variant: "destructive",
                  });
                  return;
                }

                const assignmentsToDelete = assignments.filter(a => {
                  if (a.year !== deleteYearInput.year) return false;
                  // Nếu semester là "all" hoặc rỗng, xóa cả 2 học kỳ
                  if (deleteYearInput.semester && deleteYearInput.semester !== "all" && a.semester !== deleteYearInput.semester) return false;
                  return true;
                });

                if (assignmentsToDelete.length === 0) {
                  toast({
                    title: "Thông báo",
                    description: `Không có phân công nào cho năm ${deleteYearInput.year}${deleteYearInput.semester && deleteYearInput.semester !== "all" ? `, học kỳ ${deleteYearInput.semester}` : ''}`,
                  });
                  setDeleteYearDialog(false);
                  return;
                }

                setIsDeleting(true);
                setDeleteProgress({ current: 0, total: assignmentsToDelete.length });

                try {
                  let deletedCount = 0;
                  for (let i = 0; i < assignmentsToDelete.length; i++) {
                    try {
                      await removeAssignment(assignmentsToDelete[i]._id);
                      deletedCount++;
                      setDeleteProgress({ current: i + 1, total: assignmentsToDelete.length });
                    } catch (err) {
                      console.error("Lỗi xóa phân công:", err);
                    }
                  }

                  toast({
                    title: "Thành công",
                    description: `Đã xóa ${deletedCount}/${assignmentsToDelete.length} phân công của năm ${deleteYearInput.year}${deleteYearInput.semester && deleteYearInput.semester !== "all" ? `, học kỳ ${deleteYearInput.semester}` : ''}`,
                  });
                  setDeleteYearDialog(false);
                  setDeleteYearInput({ year: "", semester: "all" });
                } catch (error) {
                  console.error("Lỗi xóa phân công:", error);
                  toast({
                    title: "Lỗi",
                    description: "Có lỗi xảy ra khi xóa phân công.",
                    variant: "destructive",
                  });
                } finally {
                  setIsDeleting(false);
                  setDeleteProgress({ current: 0, total: 0 });
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xóa ({deleteProgress.current}/{deleteProgress.total})...
                </>
              ) : (
                "Xác nhận xóa"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ Dialog loading khi phân công tự động */}
      <Dialog open={autoAssignLoading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đang xử lý...</DialogTitle>
            <DialogDescription>
              {deleteProgress.total > 0
                ? `Đang xóa phân công cũ: ${deleteProgress.current}/${deleteProgress.total}`
                : "Đang tạo phân công tự động..."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          {deleteProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tiến độ</span>
                <span>{deleteProgress.current}/{deleteProgress.total}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ Dialog xem đề xuất của trưởng bộ môn */}
      <Dialog open={proposalsOpen} onOpenChange={setProposalsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Đề xuất phân công giảng dạy
            </DialogTitle>
            <DialogDescription>
              Danh sách đề xuất phân công của tổ bộ môn bạn
            </DialogDescription>
          </DialogHeader>

          {proposalsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Chưa có đề xuất nào
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Môn học</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Giáo viên</TableHead>
                    <TableHead>Năm học</TableHead>
                    <TableHead>Học kỳ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => (
                    <TableRow key={proposal._id}>
                      <TableCell>{proposal.subjectId?.name || "N/A"}</TableCell>
                      <TableCell>{proposal.classId?.className || "N/A"}</TableCell>
                      <TableCell>{proposal.teacherId?.name || "N/A"}</TableCell>
                      <TableCell>{proposal.year}</TableCell>
                      <TableCell>Học kỳ {proposal.semester}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            proposal.status === "approved"
                              ? "default"
                              : proposal.status === "pending"
                              ? "secondary"
                              : proposal.status === "rejected"
                              ? "destructive"
                              : proposal.status === "applied"
                              ? "outline"
                              : "secondary"
                          }
                        >
                          {proposal.status === "pending" && "Chờ duyệt"}
                          {proposal.status === "approved" && "Đã duyệt"}
                          {proposal.status === "rejected" && "Đã từ chối"}
                          {proposal.status === "applied" && "Đã áp dụng"}
                          {proposal.status === "cancelled" && "Đã hủy"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {proposal.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await proposalApi.cancel(proposal._id);
                                toast({
                                  title: "Thành công",
                                  description: "Đã hủy đề xuất",
                                });
                                await loadProposals();
                              } catch (error: any) {
                                toast({
                                  title: "Lỗi",
                                  description: error.response?.data?.error || "Không thể hủy đề xuất",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Hủy
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProposalsOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog chọn thông tin phân công tự động */}
<Dialog open={autoAssignOpen} onOpenChange={(open) => {
  setAutoAssignOpen(open);
  if (open) {
    // Tự động set năm học hiện tại (active) khi mở dialog
    if (currentYear) {
      setAutoYear(currentYear);
      setUseCustomYear(false);
      setAutoYearInput("");
    } else if (schoolYears.length > 0) {
      // Nếu không có currentYear, lấy năm học đầu tiên
      const activeYear = schoolYears.find(y => y.isCurrent) || schoolYears[0];
      if (activeYear) {
        setAutoYear(activeYear.code);
        setUseCustomYear(false);
        setAutoYearInput("");
      }
    }
  }
}}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>🤖 Phân công tự động</DialogTitle>
      <DialogDescription>
        Hệ thống sẽ tự động phân công giáo viên dựa trên các tiêu chí sau.
      </DialogDescription>
      <div className="text-sm text-muted-foreground mt-2 space-y-1">
        <div>• Môn học và khối lớp giáo viên dạy</div>
        <div>• Số lớp tối đa theo khối (maxClassPerGrade)</div>
        <div>• Số tiết tối đa/tuần (weeklyLessons)</div>
        <div>• Ưu tiên giáo viên có môn chính trùng với môn học</div>
        <div>• Loại bỏ giáo viên BGH</div>
      </div>
    </DialogHeader>

    <div className="space-y-4 mt-2">
      {/* Năm học */}
      <div>
        <label className="block mb-1 text-sm font-medium">Năm học</label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="year-select"
              checked={!useCustomYear}
              onChange={() => {
                setUseCustomYear(false);
                if (currentYear) {
                  setAutoYear(currentYear);
                }
              }}
              className="w-4 h-4"
            />
            <label htmlFor="year-select" className="text-sm cursor-pointer">
              Chọn từ danh sách năm học
            </label>
          </div>
          {!useCustomYear && (
            <Select
          value={autoYear}
              onValueChange={setAutoYear}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn năm học" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((y) => (
                  <SelectItem key={y.code} value={y.code}>
                    {y.name} {y.isCurrent && "(Năm học hiện tại)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="year-custom"
              checked={useCustomYear}
              onChange={() => {
                setUseCustomYear(true);
                setAutoYear(autoYearInput || "");
              }}
              className="w-4 h-4"
            />
            <label htmlFor="year-custom" className="text-sm cursor-pointer">
              Tự nhập năm học
            </label>
          </div>
          {useCustomYear && (
            <Input
              value={autoYearInput}
              onChange={(e) => {
                setAutoYearInput(e.target.value);
                setAutoYear(e.target.value);
              }}
          placeholder="VD: 2024-2025"
        />
          )}
        </div>
        {autoYear && (
          <p className="text-xs text-muted-foreground mt-1">
            Đã chọn: <strong>{autoYear}</strong>
          </p>
        )}
      </div>

      {/* Học kỳ */}
      <div>
        <label className="block mb-1 text-sm font-medium">Học kỳ</label>
        <Select value={autoSemester} onValueChange={(v) => setAutoSemester(v as "1" | "2")}>
          <SelectTrigger>
            <SelectValue placeholder="Chọn học kỳ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Học kỳ 1</SelectItem>
            <SelectItem value="2">Học kỳ 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chọn khối */}
      <div>
        <label className="block mb-1 text-sm font-medium">Chọn khối</label>
        <div className="flex flex-col space-y-2">
          {["10", "11", "12"].map((grade) => {
            const classesForGrade = classes.filter(c => 
              String(c.grade) === grade && c.year === autoYear
            ).length;
            return (
              <label key={grade} className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedGrades.includes(grade)}
                onChange={(e) => {
                  if (e.target.checked)
                    setSelectedGrades([...selectedGrades, grade]);
                  else
                    setSelectedGrades(selectedGrades.filter((g) => g !== grade));
                }}
              />
              <span>Khối {grade}</span>
                </div>
                {autoYear && (
                  <span className="text-xs text-muted-foreground">
                    ({classesForGrade} lớp)
                  </span>
                )}
            </label>
            );
          })}
        </div>
      </div>
      
      {/* ✅ Thông tin thống kê */}
      {autoYear && selectedGrades.length > 0 && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Thông tin phân công:</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• Năm học: <strong>{autoYear}</strong></p>
            <p>• Học kỳ: <strong>{autoSemester}</strong></p>
            <p>• Khối: <strong>{selectedGrades.join(", ")}</strong></p>
            <p>• Số lớp: <strong>
              {classes.filter(c => 
                selectedGrades.includes(String(c.grade)) && c.year === autoYear
              ).length}
            </strong></p>
            <p>• Giáo viên có thể phân công: <strong>
              {teachers.filter(t => 
                !t.isLeader && 
                t.status === 'active' && 
                t.subjects && t.subjects.length > 0
              ).length}
            </strong> (đã loại BGH)</p>
          </div>
        </div>
      )}
    </div>

    <DialogFooter className="mt-4">
      <Button variant="outline" onClick={() => setAutoAssignOpen(false)} disabled={autoAssignLoading}>
        Hủy
      </Button>
      <Button 
        onClick={handleConfirmAutoAssign} 
        disabled={autoAssignLoading || !autoYear || selectedGrades.length === 0}
      >
        {autoAssignLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang xử lý...
          </>
        ) : (
          "Xác nhận phân công"
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* ✅ Dialog kiểm tra môn thiếu giáo viên */}
      <Dialog open={checkMissingOpen} onOpenChange={setCheckMissingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Kiểm tra môn thiếu giáo viên
            </DialogTitle>
            <DialogDescription>
              So sánh ClassPeriods với TeachingAssignment để phát hiện các lớp/môn chưa có giáo viên
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Form chọn thông tin */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">Năm học</label>
                <Input
                  value={checkYear}
                  onChange={(e) => setCheckYear(e.target.value)}
                  placeholder="VD: 2025-2026"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Học kỳ</label>
                <Select value={checkSemester} onValueChange={(v) => setCheckSemester(v as "1" | "2")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn học kỳ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Học kỳ 1</SelectItem>
                    <SelectItem value="2">Học kỳ 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Khối</label>
                <Select value={checkGrade} onValueChange={setCheckGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn khối" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả khối</SelectItem>
                    <SelectItem value="10">Khối 10</SelectItem>
                    <SelectItem value="11">Khối 11</SelectItem>
                    <SelectItem value="12">Khối 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleCheckMissingTeachers} 
              disabled={checkMissingLoading || !checkYear || !checkSemester}
              className="w-full"
            >
              {checkMissingLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang kiểm tra...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Kiểm tra
                </>
              )}
            </Button>

            {/* Hiển thị kết quả */}
            {missingTeachersData && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-semibold">{missingTeachersData.message}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tổng số lớp: {missingTeachersData.summary.totalClasses} | 
                    Thiếu giáo viên: {missingTeachersData.summary.totalMissing} lớp/môn
                  </p>
                </div>

                {/* Thống kê theo môn */}
                {missingTeachersData.summary.bySubject.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Thống kê theo môn học:</h4>
                    <div className="space-y-2">
                      {missingTeachersData.summary.bySubject.map((subject: any) => (
                        <Card key={subject.subjectId}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{subject.subjectName} ({subject.subjectCode})</p>
                                <p className="text-sm text-muted-foreground">
                                  Thiếu {subject.missingClassesCount} lớp | 
                                  Tổng {subject.totalRequiredPeriods} tiết chưa có giáo viên
                                </p>
                              </div>
                              <Badge variant="destructive">
                                {subject.missingClassesCount} lớp
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Danh sách chi tiết */}
                {missingTeachersData.missingAssignments.length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Danh sách chi tiết:</h4>
                      <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Lớp</TableHead>
                              <TableHead>Môn học</TableHead>
                              <TableHead>Số tiết/tuần</TableHead>
                              <TableHead>Trạng thái</TableHead>
                              <TableHead>Gợi ý giáo viên</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {missingTeachersData.missingAssignments.map((item: any, index: number) => {
                              // Tìm giáo viên có thể dạy môn này
                              const suitableTeachers = teachers.filter((teacher: any) => {
                                const teachesSubject = teacher.subjects?.some(
                                  (sub: any) => sub.subjectId?._id?.toString() === item.subjectId.toString() ||
                                                sub.subjectId?.toString() === item.subjectId.toString()
                                ) || teacher.mainSubject?._id?.toString() === item.subjectId.toString() ||
                                   teacher.mainSubject?.toString() === item.subjectId.toString();
                                
                                // Kiểm tra giáo viên chưa đạt số lớp tối đa
                                const teacherAssignments = assignments.filter(
                                  (a: any) => {
                                    const teacherId = typeof a.teacherId === 'object' ? a.teacherId?._id : a.teacherId;
                                    return teacherId === teacher._id && 
                                           a.year === checkYear && 
                                           a.semester === checkSemester;
                                  }
                                );
                                const maxClasses = teacher.maxClasses || 3;
                                const canTakeMore = teacherAssignments.length < maxClasses;
                                
                                return teachesSubject && canTakeMore;
                              });

                              return (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{item.className}</TableCell>
                                  <TableCell>{item.subjectName} ({item.subjectCode})</TableCell>
                                  <TableCell>{item.requiredPeriods} tiết</TableCell>
                                  <TableCell>
                                    <Badge variant="destructive">Thiếu giáo viên</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {suitableTeachers.length > 0 ? (
                                      <div className="space-y-1">
                                        {suitableTeachers.slice(0, 3).map((teacher: any) => (
                                          <div key={teacher._id} className="text-xs">
                                            <Badge variant="outline" className="text-xs">
                                              {teacher.name}
                                            </Badge>
                                          </div>
                                        ))}
                                        {suitableTeachers.length > 3 && (
                                          <p className="text-xs text-muted-foreground">
                                            +{suitableTeachers.length - 3} giáo viên khác
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        Không có giáo viên phù hợp
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Cách khắc phục */}
                    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                          Cách khắc phục
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="font-medium mb-2">1. Phân công thủ công:</p>
                          <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground ml-2">
                            <li>Bấm nút <strong>"+ Thêm phân công"</strong> ở đầu trang</li>
                            <li>Chọn lớp, môn học và giáo viên phù hợp từ danh sách gợi ý</li>
                            <li>Hệ thống sẽ tự động kiểm tra ràng buộc (số lớp tối đa, số tiết tối đa/tuần)</li>
                          </ul>
                        </div>

                        <div>
                          <p className="font-medium mb-2">2. Phân công tự động:</p>
                          <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground ml-2">
                            <li>Bấm nút <strong>"🤖 Phân công tự động"</strong> ở đầu trang</li>
                            <li>Chọn năm học, học kỳ và khối cần phân công</li>
                            <li>Hệ thống sẽ tự động gán giáo viên phù hợp dựa trên:
                              <ul className="list-circle list-inside ml-4 mt-1">
                                <li>Giáo viên có dạy môn học đó</li>
                                <li>Lịch rảnh của giáo viên</li>
                                <li>Số lớp tối đa và số tiết tối đa/tuần</li>
                              </ul>
                            </li>
                          </ul>
                        </div>

                        <div>
                          <p className="font-medium mb-2">3. Kiểm tra giáo viên:</p>
                          <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground ml-2">
                            <li>Đảm bảo giáo viên đã được cấu hình môn học trong thông tin giáo viên</li>
                            <li>Kiểm tra số lớp tối đa và số tiết tối đa/tuần của giáo viên</li>
                            <li>Xem lịch rảnh của giáo viên tại trang <strong>"Lịch rảnh giáo viên"</strong></li>
                          </ul>
                        </div>

                        <div className="pt-2 border-t">
                          <Button 
                            variant="default" 
                            className="w-full"
                            onClick={() => {
                              setCheckMissingOpen(false);
                              setOpen(true);
                            }}
                          >
                            + Thêm phân công ngay
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <p className="text-green-700 dark:text-green-400 font-semibold">
                      ✅ Tất cả các lớp đã có giáo viên được phân công!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCheckMissingOpen(false);
              setMissingTeachersData(null);
            }}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ Dialog xem đề xuất phân công từ quản lý bộ môn */}
      <Dialog open={proposalsOpen} onOpenChange={setProposalsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Đề xuất phân công từ quản lý bộ môn</DialogTitle>
                <DialogDescription>
                  Xem và duyệt các đề xuất phân công giảng dạy từ trưởng bộ môn
                </DialogDescription>
              </div>
              {filteredProposals.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={async () => {
                      const pendingProposals = filteredProposals.filter(p => p.status === "pending");
                      if (pendingProposals.length === 0) {
                        window.alert("Không có đề xuất nào đang chờ duyệt");
                        return;
                      }
                      const confirmed = window.confirm(
                        `Bạn có chắc chắn muốn duyệt tất cả ${pendingProposals.length} đề xuất đang chờ duyệt?`
                      );
                      if (!confirmed) return;

                      try {
                        setProposalsLoading(true);
                        // Duyệt từng proposal
                        for (const proposal of pendingProposals) {
                          await proposalApi.approve(proposal._id);
                        }
                        toast({
                          title: "Thành công",
                          description: `Đã duyệt ${pendingProposals.length} đề xuất`,
                        });
                        loadProposals();
                        refetchAssignments();
                      } catch (error: any) {
                        toast({
                          title: "Lỗi",
                          description: error.response?.data?.message || "Không thể duyệt tất cả đề xuất",
                          variant: "destructive",
                        });
                      } finally {
                        setProposalsLoading(false);
                      }
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Duyệt tất cả
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      const toRejectProposals = filteredProposals.filter(
                        p => p.status === "pending" || p.status === "approved"
                      );
                      if (toRejectProposals.length === 0) {
                        window.alert("Không có đề xuất nào để từ chối");
                        return;
                      }
                      const confirmed = window.confirm(
                        `Bạn có chắc chắn muốn từ chối tất cả ${toRejectProposals.length} đề xuất?`
                      );
                      if (!confirmed) return;

                      const reason = window.prompt("Lý do từ chối (bắt buộc):");
                      if (!reason || reason.trim() === "") {
                        window.alert("Vui lòng nhập lý do từ chối");
                        return;
                      }

                      try {
                        setProposalsLoading(true);
                        // Từ chối từng proposal
                        for (const proposal of toRejectProposals) {
                          await proposalApi.reject(proposal._id, reason);
                        }
                        toast({
                          title: "Thành công",
                          description: `Đã từ chối ${toRejectProposals.length} đề xuất`,
                        });
                        loadProposals();
                        refetchAssignments();
                      } catch (error: any) {
                        toast({
                          title: "Lỗi",
                          description: error.response?.data?.message || "Không thể từ chối tất cả đề xuất",
                          variant: "destructive",
                        });
                      } finally {
                        setProposalsLoading(false);
                      }
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Từ chối tất cả
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {proposalsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredProposals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Không có đề xuất nào đang chờ duyệt hoặc đã duyệt
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Giáo viên</TableHead>
                    <TableHead>Môn học</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Năm học</TableHead>
                    <TableHead>Học kỳ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Người đề xuất</TableHead>
                    <TableHead>Tổ bộ môn</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.map((proposal) => (
                    <TableRow key={proposal._id}>
                      <TableCell>
                        {proposal.teacherId?.name}
                        {proposal.teacherId?.teacherCode && (
                          <span className="text-xs text-muted-foreground block">
                            {proposal.teacherId.teacherCode}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{proposal.subjectId?.name}</TableCell>
                      <TableCell>
                        {proposal.classId?.className}
                        {proposal.classId?.grade && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Khối {proposal.classId.grade}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{proposal.year}</TableCell>
                      <TableCell>Học kỳ {proposal.semester}</TableCell>
                      <TableCell>
                        {proposal.status === "pending" && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            <Clock className="h-3 w-3 mr-1" />Chờ duyệt
                          </Badge>
                        )}
                        {proposal.status === "approved" && (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />Đã duyệt
                          </Badge>
                        )}
                        {proposal.status === "rejected" && (
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            <XCircle className="h-3 w-3 mr-1" />Bị từ chối
                          </Badge>
                        )}
                        {proposal.status === "applied" && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            <CheckCircle className="h-3 w-3 mr-1" />Đã áp dụng
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {proposal.proposedBy?.name}
                        {proposal.proposedBy?.teacherCode && (
                          <span className="text-xs text-muted-foreground block">
                            {proposal.proposedBy.teacherCode}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{proposal.departmentId?.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {proposal.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={async () => {
                                  try {
                                    await proposalApi.approve(proposal._id);
                                    toast({
                                      title: "Thành công",
                                      description: "Đã duyệt đề xuất",
                                    });
                                    loadProposals();
                                    refetchAssignments();
                                  } catch (error: any) {
                                    toast({
                                      title: "Lỗi",
                                      description: error.response?.data?.message || "Không thể duyệt đề xuất",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Duyệt
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  const reason = prompt("Lý do từ chối:");
                                  if (reason) {
                                    try {
                                      await proposalApi.reject(proposal._id, reason);
                                      toast({
                                        title: "Thành công",
                                        description: "Đã từ chối đề xuất",
                                      });
                                      loadProposals();
                                    } catch (error: any) {
                                      toast({
                                        title: "Lỗi",
                                        description: error.response?.data?.message || "Không thể từ chối đề xuất",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Từ chối
                              </Button>
                            </>
                          )}
                          {proposal.status === "approved" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={async () => {
                                try {
                                  await proposalApi.apply({ proposalIds: [proposal._id] });
                                  toast({
                                    title: "Thành công",
                                    description: "Đã áp dụng đề xuất vào phân công chính thức",
                                  });
                                  loadProposals();
                                  refetchAssignments();
                                } catch (error: any) {
                                  toast({
                                    title: "Lỗi",
                                    description: error.response?.data?.message || "Không thể áp dụng đề xuất",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Áp dụng
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProposalsOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

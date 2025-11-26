import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, Save, Lock, Unlock, Sparkles, Calendar, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSubjects, useAssignments, useSchoolYears } from "@/hooks";
import { scheduleApi } from "@/services/scheduleApi";
import { getScheduleConfig } from "@/services/scheduleConfigApi";
import { classApi } from "@/services/classApi";
import DeleteScheduleDialog from "@/components/dialogs/DeleteScheduleSection";
import { Subject, ClassType, TeachingAssignment } from "@/types/class";
import { ScheduleConfig, ClassSchedule } from "@/types/schedule";
import { ScheduleConfigForm } from "@/components/forms/ScheduleConfigForm";
import { GenerateScheduleDialog } from "@/components/dialogs/GenerateScheduleDialog";
import { toast } from "@/components/ui/use-toast";
import { Teacher } from "@/types/auth";
import { Loader2 } from "lucide-react";
import { autoScheduleApi } from "@/services/autoScheduleApi";
import { constraintSolverApi } from "@/services/constraintSolverApi";
// Hàm tạo màu từ tên môn học
const getSubjectColor = (subjectName: string) => {
  const colors: Record<string, string> = {
    "Toán": "#3B82F6",
    "Ngữ văn": "#EC4899",
    "Tiếng Anh": "#06B6D4",
    "Vật lý": "#8B5CF6",
    "Hóa học": "#EF4444",
    "Sinh học": "#22C55E",
    "Lịch sử": "#F59E0B",
    "Địa lý": "#10B981",
    "Tin học": "#0EA5E9",
    "Công nghệ": "#EAB308",
    "GDCD": "#9333EA",
    "Giáo dục thể chất": "#3B82F6",
    "QP-AN": "#6366F1",
  };
  return colors[subjectName] || "#64748B";
};

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ScheduleGridCellProps {
  p?: { subject?: string; teacher?: string };
  isAfternoon?: boolean;
  assignments?: TeachingAssignment[];
  onTeacherChange?: (teacherName: string) => void;
}

type ScheduleStatusInfo = {
  hasSchedule: boolean;
  isLocked: boolean;
  scheduleId?: string;
};

export const ScheduleGridCell = ({ p, isAfternoon, assignments = [], onTeacherChange }: ScheduleGridCellProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const cellRef = useRef<HTMLDivElement | null>(null);

  if (!p?.subject) return <div className="text-gray-400 text-center">-</div>;

  // Lấy danh sách giáo viên có assignment cho môn này (loại bỏ trùng theo _id)
  const teacherOptions = assignments
    .filter(a => a.subjectId?.name === p.subject)
    .map(a => ({ id: a.teacherId?._id, name: a.teacherId?.name }))
    .filter(Boolean);

  const uniqueTeachers = Array.from(new Map(teacherOptions.map(t => [t.id, t])).values());

  return (
    <div
      ref={cellRef}
      className="relative overflow-visible w-[140px] h-[70px] rounded-2xl text-white text-center shadow-md px-2 py-2 flex flex-col items-center justify-center cursor-pointer"
      style={{ backgroundColor: getSubjectColor(p.subject) }}
      onMouseEnter={() => setShowDialog(true)}
      onMouseLeave={() => setShowDialog(false)}
    >
      <div className="text-sm font-semibold truncate w-full">{p.subject}</div>

      <div className="mt-1 w-full flex justify-center">
        <Select
          value={p.teacher || ""}
          onValueChange={(v) => onTeacherChange?.(v)}
        >
<SelectTrigger className="w-[110px] h-7 text-xs bg-gray border border-gray-300 rounded-md px-2 py-0 flex items-center justify-between hover:border-blue-400 focus:ring-0 focus:outline-none">
  <SelectValue placeholder="GV ▼" />
</SelectTrigger>


          <SelectContent className="max-h-60 overflow-y-auto rounded-md shadow-md">
            {uniqueTeachers.length > 0 ? (
              uniqueTeachers.map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  {t.name}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-sm text-muted-foreground">Chưa có giáo viên phù hợp</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {showDialog &&
        createPortal(
          <div
            className="fixed z-[9999] bg-white text-gray-800 rounded-xl shadow-lg px-4 py-3 w-[220px] border border-gray-200 animate-in fade-in zoom-in"
            style={{
              top: (cellRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
              left:
                (cellRef.current?.getBoundingClientRect().left ?? 0) +
                (cellRef.current?.offsetWidth ?? 0) / 2 -
                110,
            }}
          >
            <div className="font-semibold text-base mb-1 text-primary">{p.subject}</div>
            {p.teacher ? (
              <div className="text-sm text-gray-700">{p.teacher}</div>
            ) : (
              <div className="text-sm text-gray-400 italic">Chưa có giáo viên</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

// 👉 Ô có thể kéo
const SortableCell = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging ? "#e0f2fe" : undefined,
  };

  // ✅ Sử dụng div thay vì TableCell vì đang dùng trong grid layout, không phải table
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-move relative overflow-visible p-2 border-r last:border-r-0 min-h-[60px]"
    >
      {children}
    </div>
  );
};

export default function SchedulePageNew() {
  // ✅ Sử dụng hooks
  const { subjects } = useSubjects();
  const { assignments } = useAssignments();
  const { schoolYears, isLoading: isLoadingYears } = useSchoolYears();
  
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(null);
  const [schedule, setSchedule] = useState<ClassSchedule | null>(null);
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  // ✅ Map để lưu trạng thái schedule cho mỗi lớp: { classId: { hasSchedule: boolean, isLocked: boolean } }
  const [scheduleStatusMap, setScheduleStatusMap] = useState<Record<string, ScheduleStatusInfo>>({});

  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("1");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [semesterDates, setSemesterDates] = useState<{ startDate?: string; endDate?: string }>({});

  const [days, setDays] = useState<{ key: string; label: string }[]>([]);
  const sensors = useSensors(useSensor(PointerSensor));
  
  // ✅ State cho AlertDialog xác nhận tạo TKB cho 1 lớp
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingClass, setPendingClass] = useState<{ id: string; name: string } | null>(null);
  
  // ✅ State để quản lý các khối đang mở trong Accordion
  const [openGrades, setOpenGrades] = useState<string[]>([]);
  const [lockingClassId, setLockingClassId] = useState<string | null>(null);

  const hasYearAndSemester = Boolean(selectedYear && selectedSemester);

  const allSchedulesLocked =
    hasYearAndSemester &&
    classes.length > 0 &&
    classes.every((cls) => {
      const status = scheduleStatusMap[String((cls as any)._id)];
      return status?.isLocked === true;
    });

  const lockAllButtonLabel = allSchedulesLocked ? "🔓 Mở khóa tất cả lịch" : "🔒 Khóa tất cả lịch";

  // ✅ Load năm học từ API và set năm học mặc định
  useEffect(() => {
    if (schoolYears.length > 0 && !selectedYear) {
      // Ưu tiên lấy năm học active, nếu không có thì lấy năm học đầu tiên
      const activeYear = schoolYears.find((y: any) => y.isActive) || schoolYears[0];
      if (activeYear) {
        setSelectedYear(activeYear.code);
      } else {
        // Fallback: Tự tính năm học hiện tại
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        setSelectedYear(month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`);
      }
    }
  }, [schoolYears]);

  // ✅ Lấy ngày bắt đầu/kết thúc học kỳ
  useEffect(() => {
    if (selectedYear && selectedSemester && schoolYears.length > 0) {
      const schoolYear = schoolYears.find((y: any) => y.code === selectedYear);
      if (schoolYear?.semesters && schoolYear.semesters.length > 0) {
        // Tìm học kỳ tương ứng (code: "HK1" hoặc "HK2", hoặc name: "Học kỳ 1"/"Học kỳ 2")
        const semesterCode = selectedSemester === "1" ? "HK1" : "HK2";
        const semester = schoolYear.semesters.find(
          (s: any) => s.code === semesterCode || s.code === selectedSemester || s.name?.includes(selectedSemester)
        );
        if (semester) {
          setSemesterDates({
            startDate: semester.startDate,
            endDate: semester.endDate,
          });
        } else {
          setSemesterDates({});
        }
      } else {
        setSemesterDates({});
      }
    } else {
      setSemesterDates({});
    }
  }, [selectedYear, selectedSemester, schoolYears]);

  // ✅ Load lớp theo năm học được chọn
  useEffect(() => {
    if (!selectedYear) return;
    
    const loadClasses = async () => {
      try {
        setIsLoadingClasses(true);
        const classesData = await classApi.getByYear(selectedYear);
        setClasses(classesData);
        
        // Reset selected class nếu lớp hiện tại không còn trong danh sách
        if (selectedClassId && !classesData.find((c: ClassType) => c._id === selectedClassId)) {
          setSelectedClassId(null);
          setSchedule(null);
        }
        
        // ✅ Mở tất cả các khối mặc định khi load lớp
        const grades = Array.from(new Set(classesData.map((c: ClassType) => c.grade).filter(Boolean))) as string[];
        const sortedGrades = grades.sort((a, b) => {
          const numA = parseInt(a) || 999;
          const numB = parseInt(b) || 999;
          return numA - numB;
        });
        if (sortedGrades.length > 0 && openGrades.length === 0) {
          setOpenGrades(sortedGrades);
        }
      } catch (err) {
        console.error("Lỗi tải danh sách lớp:", err);
        toast({
          title: "❌ Lỗi",
          description: "Không thể tải danh sách lớp. Vui lòng thử lại.",
          variant: "destructive",
        });
        setClasses([]);
      } finally {
        setIsLoadingClasses(false);
      }
    };
    
    loadClasses();
  }, [selectedYear]);

  const loadScheduleStatus = useCallback(async () => {
    if (!selectedYear || !selectedSemester) {
      setScheduleStatusMap({});
      return;
    }

    try {
      const schedules = await scheduleApi.getSchedulesByYearSemester(selectedYear, selectedSemester);
      const statusMap: Record<string, ScheduleStatusInfo> = {};

      if (Array.isArray(schedules)) {
        schedules.forEach((schedule: any) => {
          const classId =
            typeof schedule.classId === "string"
              ? schedule.classId
              : schedule.classId?._id?.toString() || schedule.classId?.toString() || "";

          if (classId) {
            statusMap[classId] = {
              hasSchedule: true,
              isLocked: schedule.isLocked || false,
              scheduleId: schedule._id,
            };
          }
        });
      }

      setScheduleStatusMap(statusMap);
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.warn("⚠️ Không thể tải trạng thái lịch học:", err);
      }
      setScheduleStatusMap({});
    }
  }, [selectedYear, selectedSemester]);

  // ✅ Load trạng thái schedule cho tất cả lớp khi thay đổi năm học/học kỳ
  useEffect(() => {
    loadScheduleStatus();
  }, [loadScheduleStatus]);

  // ✅ Cập nhật trạng thái schedule khi schedule được tạo/cập nhật/xóa
  useEffect(() => {
    if (!schedule || !selectedClassId) return;
    
    setScheduleStatusMap(prev => ({
      ...prev,
      [selectedClassId]: {
        hasSchedule: true,
        isLocked: schedule.isLocked || false,
        scheduleId: (schedule as any)?._id,
      }
    }));
  }, [schedule, selectedClassId]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await getScheduleConfig();
        setScheduleConfig(res);

        const mappedDays = Object.keys(res.days).map((key) => ({
          key,
          label:
            key === "Monday"
              ? "Thứ 2"
              : key === "Tuesday"
              ? "Thứ 3"
              : key === "Wednesday"
              ? "Thứ 4"
              : key === "Thursday"
              ? "Thứ 5"
              : key === "Friday"
              ? "Thứ 6"
              : key === "Saturday"
              ? "Thứ 7"
              : "Chủ nhật",
        }));
        setDays(mappedDays);
      } catch (err) {
        console.error("Lỗi tải cấu hình TKB:", err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!selectedClassId || !selectedYear || !selectedSemester) return;
    const fetchSchedule = async () => {
      try {
        const data = await scheduleApi.getScheduleByClass(
          selectedClassId,
          selectedYear,
          selectedSemester
        );
        setSchedule(data || null);
      } catch (err: any) {
        // ✅ 404 là bình thường nếu chưa tạo lịch - không cần log error
        if (err.response?.status === 404) {
          console.log("Chưa có thời khóa biểu cho lớp này. Vui lòng tạo lịch.");
          setSchedule(null);
        } else {
          // ✅ Chỉ log error cho các lỗi khác 404
          console.error("Lỗi tải thời khóa biểu:", err);
          toast({
            title: "❌ Lỗi",
            description: err.response?.data?.message || "Không thể tải thời khóa biểu. Vui lòng thử lại.",
            variant: "destructive",
          });
          setSchedule(null);
        }
      }
    };
    fetchSchedule();
  }, [selectedClassId, selectedYear, selectedSemester]);

  const isTeacherAvailable = (teacher: string, day: string, period: number) => {
    if (!schedule) return true;
    for (const d of schedule.timetable) {
      if (d.day !== day) continue;
      const existing = d.periods[period];
      if (existing?.teacher === teacher) return false;
    }
    return true;
  };

  const handleTeacherChange = (dayKey: string, periodIdx: number, teacher: string) => {
    if (!schedule) return;

    // ✅ Không cho phép thay đổi giáo viên nếu schedule đã khóa
    if (schedule.isLocked === true) {
      toast({
        title: "🔒 Thời khóa biểu đã khóa",
        description: "Không thể chỉnh sửa thời khóa biểu đã khóa. Vui lòng mở khóa trước.",
        variant: "destructive",
      });
      return;
    }

    if (!isTeacherAvailable(teacher, dayKey, periodIdx)) {
      toast({ title: "❌ Giáo viên bận", description: `${teacher} đã có lớp khác trong tiết này`, variant: "destructive" });
      return;
    }

    const newSchedule = { ...schedule };
    const dayEntry = newSchedule.timetable.find(d => d.day === dayKey);
    if (!dayEntry) return;
    dayEntry.periods[periodIdx] = { ...dayEntry.periods[periodIdx], teacher };
    setSchedule(newSchedule);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !schedule) return;

    // ✅ Không cho phép drag-and-drop nếu schedule đã khóa
    if (schedule.isLocked === true) {
      toast({
        title: "🔒 Thời khóa biểu đã khóa",
        description: "Không thể chỉnh sửa thời khóa biểu đã khóa. Vui lòng mở khóa trước.",
        variant: "destructive",
      });
      return;
    }

    const newSchedule = { ...schedule };

    if (active.id.toString().startsWith("unassigned-")) {
      const subject = active.id.toString().replace("unassigned-", "");
      const [day, idx] = over.id.toString().split("-");
      const dayEntry = newSchedule.timetable.find(d => d.day === day);
      if (!dayEntry) return;
      
      // ✅ Tìm giáo viên được phân công cho môn này trong lớp này
      let teacherName: string | undefined = undefined;
      let teacherId: string | undefined = undefined;
      let subjectId: string | undefined = undefined;
      
      if (selectedClassId && selectedYear && selectedSemester) {
        // ✅ Tìm subjectId từ tên môn học
        const subjectObj = subjects.find(s => s.name === subject);
        if (subjectObj?._id) {
          const subjectIdValue = subjectObj._id;
          subjectId = typeof subjectIdValue === 'string' ? subjectIdValue : (subjectIdValue as any)?.toString?.() || String(subjectIdValue);
        }
        
        // ✅ Lấy assignments cho lớp này
        const classAssignments = assignments.filter(a => {
          if (!a.classId || !selectedClassId) return false;
          const classId = typeof a.classId === 'string' ? a.classId : (a.classId as any)?._id;
          return classId === selectedClassId && 
                 a.year === selectedYear && 
                 a.semester === selectedSemester;
        });
        
        // ✅ Tìm assignment cho môn học này (ưu tiên so sánh subjectId, fallback so sánh tên)
        const assignment = classAssignments.find(a => {
          const assignmentSubjectId = typeof a.subjectId === 'string' 
            ? a.subjectId 
            : (a.subjectId as any)?._id?.toString();
          const assignmentSubjectName = typeof a.subjectId === 'string' 
            ? subjects.find(s => {
                const sId = typeof s._id === 'string' ? s._id : (s._id as any)?._id?.toString() || String(s._id);
                return sId === a.subjectId;
              })?.name
            : (a.subjectId as any)?.name;
          
          // Ưu tiên so sánh ID, nếu không có thì so sánh tên
          if (subjectId && assignmentSubjectId) {
            return assignmentSubjectId === subjectId;
          }
          return assignmentSubjectName === subject;
        });
        
        if (assignment?.teacherId) {
          teacherName = typeof assignment.teacherId === 'string'
            ? undefined // Nếu chỉ có ID, không có tên
            : (assignment.teacherId as any)?.name;
          teacherId = typeof assignment.teacherId === 'string'
            ? assignment.teacherId
            : (assignment.teacherId as any)?._id?.toString();
        }
      }
      
      // ✅ Gán môn học và giáo viên vào period
      dayEntry.periods[+idx] = { 
        period: +idx, 
        subject, 
        teacher: teacherName,
        teacherId: teacherId,
        subjectId: subjectId
      };
      setSchedule(newSchedule);
      return;
    }

    const [dayA, idxA] = active.id.toString().split("-");
    const [dayB, idxB] = over.id.toString().split("-");
    const entryA = newSchedule.timetable.find((d) => d.day === dayA);
    const entryB = newSchedule.timetable.find((d) => d.day === dayB);
    if (!entryA || !entryB) return;

    const temp = entryA.periods[+idxA];
    entryA.periods[+idxA] = entryB.periods[+idxB];
    entryB.periods[+idxB] = temp;

    setSchedule(newSchedule);
  };

  // ✅ Xử lý tạo lịch tự động cho các lớp theo khối
  const handleGenerateSchedule = async (
    targetGrades: string[],
    year: string,
    semester: string
  ) => {
    try {
      toast({
        title: "⏳ Đang tạo lịch tự động...",
        description: `Đang tạo lịch cho khối ${targetGrades.join(", ")} - ${year} HK${semester}`,
      });

      const result = await autoScheduleApi.generateSchedule(
        targetGrades,
        year,
        semester
      );

      console.log("📥 Kết quả tạo lịch:", result);

      toast({
        title: "✅ Tạo lịch thành công",
        description: `Đã tạo lịch cho ${result.schedules?.length || 0} lớp`,
      });

      // ✅ Reload schedules nếu đang xem lớp trong khối đã tạo
      if (selectedClassId && selectedYear === year && selectedSemester === semester) {
        const fetchSchedule = async () => {
          try {
            const data = await scheduleApi.getScheduleByClass(
              selectedClassId,
              year,
              semester
            );
            setSchedule(data);
          } catch (err: any) {
            if (err.response?.status !== 404) {
              console.error("Lỗi tải thời khóa biểu:", err);
            }
          }
        };
        await fetchSchedule();
      }

      // ✅ Reload danh sách lớp để cập nhật
      if (selectedYear === year) {
        const classesData = await classApi.getByYear(selectedYear);
        setClasses(classesData);
      }
    } catch (err: any) {
      console.error("❌ Lỗi tạo thời khóa biểu:", err);
      toast({
        title: "❌ Lỗi",
        description: err.response?.data?.message || "Không thể tạo thời khóa biểu",
        variant: "destructive",
      });
      (err as any).__handled = true;
      throw err;
    }
  };

  const handleToggleClassLock = async (
    classId: string,
    className: string,
    status?: ScheduleStatusInfo
  ) => {
    if (!status?.scheduleId) {
      toast({
        title: "⚠️ Chưa có thời khóa biểu",
        description: "Vui lòng tạo thời khóa biểu trước khi khóa/mở khóa.",
        variant: "destructive",
      });
      return;
    }

    const nextLockState = !status.isLocked;
    setLockingClassId(classId);
    try {
      await scheduleApi.lockSchedule(status.scheduleId, nextLockState);
      setScheduleStatusMap((prev) => ({
        ...prev,
        [classId]: {
          hasSchedule: true,
          isLocked: nextLockState,
          scheduleId: status.scheduleId,
        },
      }));

      if (schedule && selectedClassId === classId) {
        setSchedule({ ...schedule, isLocked: nextLockState });
      }

      toast({
        title: nextLockState ? "🔒 Đã khóa lớp" : "🔓 Đã mở khóa lớp",
        description: `Lớp ${className} ${nextLockState ? "không thể chỉnh sửa" : "có thể chỉnh sửa lại"}.`,
      });
    } catch (err: any) {
      console.error("❌ Lỗi khi khóa/mở khóa lớp:", err);
      toast({
        title: "❌ Lỗi",
        description:
          err.response?.data?.message ||
          err.message ||
          "Không thể cập nhật trạng thái khóa. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setLockingClassId(null);
    }
  };

  const reloadSchedulesAfterGenerate = async () => {
    if (selectedClassId && selectedYear && selectedSemester) {
      try {
        const data = await scheduleApi.getScheduleByClass(
          selectedClassId,
          selectedYear,
          selectedSemester
        );
        setSchedule(data);
      } catch (err: any) {
        if (err.response?.status !== 404) {
          console.error("Lỗi tải thời khóa biểu:", err);
        }
      }
    }

    if (selectedYear) {
      try {
        const classesData = await classApi.getByYear(selectedYear);
        setClasses(classesData);
      } catch (err) {
        console.error("Lỗi tải danh sách lớp:", err);
      }
    }

    await loadScheduleStatus();
  };

  const handleBacktrackingGenerate = async ({
    grades,
    year,
    semester,
  }: {
    grades: string[];
    year: string;
    semester: string;
    includeActivities: boolean;
  }) => {
    return constraintSolverApi.solveWithBacktracking({
      grades,
      year,
      semester,
    });
  };

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    
    // ✅ Kiểm tra nếu schedule đã khóa thì không cho phép lưu
    if (schedule.isLocked === true) {
      toast({
        title: "🔒 Thời khóa biểu đã khóa",
        description: "Thời khóa biểu này đã được khóa. Vui lòng mở khóa trước khi chỉnh sửa.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await scheduleApi.saveOrUpdateSchedule({
        ...schedule,
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: "✅ Lưu thành công",
        description: `Thời khóa biểu lớp ${schedule.className} đã được cập nhật.`,
      });
    } catch (err: any) {
      console.error("Lỗi lưu thời khóa biểu:", err);
      
      // ✅ Kiểm tra nếu lỗi là do trùng giáo viên
      const errorMessage = err?.message || err?.response?.data?.message || "Không thể lưu thời khóa biểu";
      const isConflictError = errorMessage.includes("trùng giáo viên") || errorMessage.includes("Phát hiện trùng");
      const isLockedError = errorMessage.includes("khóa") || errorMessage.includes("locked");
      
      toast({
        title: isLockedError ? "🔒 Thời khóa biểu đã khóa" : isConflictError ? "⚠️ Xung đột giáo viên" : "❌ Lỗi lưu",
        description: isLockedError
          ? "Thời khóa biểu này đã được khóa. Vui lòng mở khóa trước khi chỉnh sửa."
          : isConflictError 
          ? `Không thể lưu thời khóa biểu do xung đột:\n\n${errorMessage.replace("Phát hiện trùng giáo viên:\n", "")}\n\nVui lòng kiểm tra và điều chỉnh thời khóa biểu để tránh xung đột.`
          : errorMessage,
        variant: "destructive",
        duration: isConflictError ? 10000 : 5000, // Hiển thị lâu hơn nếu là conflict
      });
    }
  };

  const getUnassignedSubjects = () => {
    if (!schedule || !scheduleConfig || !selectedClassId) return [];

    // ✅ Lấy grade của lớp hiện tại
    const selectedClass = classes.find(c => c._id === selectedClassId);
    if (!selectedClass) return [];

    const grade = selectedClass.grade as "10" | "11" | "12";
    if (!grade || !["10", "11", "12"].includes(grade)) return [];

    // ✅ Lấy assignments cho lớp này và năm học/học kỳ hiện tại
    const classAssignments = assignments.filter(a => {
      if (!a.classId || !selectedClassId) return false;
      const classId = typeof a.classId === 'string' ? a.classId : (a.classId as any)?._id;
      return classId === selectedClassId && 
             a.year === selectedYear && 
             a.semester === selectedSemester;
    });

    // ✅ Lấy cấu hình môn học từ gradeConfigs
    const gradeConfig = scheduleConfig.gradeConfigs?.[grade];
    if (!gradeConfig?.subjects) return [];

    const assignedSubjects: Record<string, number> = {};

    schedule.timetable.forEach(day => {
      day.periods.forEach(p => {
        if (p?.subject) {
          assignedSubjects[p.subject] = (assignedSubjects[p.subject] || 0) + 1;
        }
      });
    });

    const unassigned: { subject: string; remaining: number; teacher?: string }[] = [];

    // ✅ Sử dụng cấu trúc mới: gradeConfigs[grade].subjects
    for (const [subjectId, subjectConfig] of Object.entries(gradeConfig.subjects)) {
      // ✅ Tìm tên môn học từ subjectId
      const subject = subjects.find(s => s._id?.toString() === subjectId);
      if (!subject) continue;

      const subjectName = subject.name;
      const count = assignedSubjects[subjectName] || 0;
      
      // ✅ periodsPerWeek là number trong cấu trúc mới
      const periodsPerWeek = typeof subjectConfig.periodsPerWeek === 'number' 
        ? subjectConfig.periodsPerWeek 
        : 0;
      
      const remaining = periodsPerWeek - count;
      if (remaining > 0) {
        // ✅ Tìm giáo viên được phân công cho môn này trong lớp này
        const assignment = classAssignments.find(a => {
          const assignmentSubjectId = typeof a.subjectId === 'string' 
            ? a.subjectId 
            : (a.subjectId as any)?._id?.toString();
          return assignmentSubjectId === subjectId;
        });
        
        // ✅ Lấy tên giáo viên từ assignment
        const teacherName = assignment?.teacherId?.name || 
                           (assignment?.teacherId ? 'Chưa có tên' : 'Chưa phân công');
        
        unassigned.push({ subject: subjectName, remaining, teacher: teacherName });
      }
    }

    return unassigned;
  };

  const filteredClasses =
    selectedGrade === "all" ? classes : classes.filter((c) => c.grade === selectedGrade);

  const getPeriodTime = (
    config: ScheduleConfig,
    periodIdx: number,
    session: "morning" | "afternoon"
  ) => {
    const startBase =
      session === "morning"
        ? config.defaultStartTimeMorning
        : config.defaultStartTimeAfternoon;
    const [hour, minute] = startBase.split(":").map(Number);
    let totalMinutes = hour * 60 + minute;

    for (let i = 0; i < periodIdx; i++) {
      totalMinutes += config.minutesPerPeriod;
      const specialBreak = config.specialBreaks.find(
        (b) => b.period === i + 1 && b.session === session
      );
      totalMinutes += specialBreak ? specialBreak.minutes : config.defaultBreakMinutes;
    }

    const startHour = Math.floor(totalMinutes / 60);
    const startMinute = totalMinutes % 60;
    const endMinutes = totalMinutes + config.minutesPerPeriod;
    const endHour = Math.floor(endMinutes / 60);
    const endMinute = endMinutes % 60;

    return `${String(startHour).padStart(2, "0")}:${String(
      startMinute
    ).padStart(2, "0")} - ${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(
      2,
      "0"
    )}`;
  };

  const UnassignedSubjectItem = ({ subject, teacher }: { subject: string; teacher?: string }) => {
    return (
      <div
        className="cursor-move px-4 py-2 mb-2 rounded shadow text-white text-center"
        style={{ backgroundColor: getSubjectColor(subject) }}
      >
        <div className="font-semibold text-sm">{subject}</div>
        {teacher && (
          <div className="text-xs mt-1 opacity-90">GV: {teacher}</div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">📘 Quản lý Thời khóa biểu (Kéo thả)</h1>

      <Tabs defaultValue="classes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="classes">Thời khóa biểu</TabsTrigger>
          <TabsTrigger value="config">Cấu hình</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="mt-4">
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div>
              <label className="mr-2 font-semibold">Năm học:</label>
              {isLoadingYears ? (
                <div className="inline-flex items-center gap-2 border rounded px-2 py-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Đang tải...</span>
                </div>
              ) : (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="border rounded px-2 py-1"
                  disabled={schoolYears.length === 0}
                >
                  {schoolYears.length === 0 ? (
                    <option value="">Chưa có năm học</option>
                  ) : (
                    schoolYears.map((year: any) => (
                      <option key={year.code} value={year.code}>
                        {year.name || year.code}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
            <div>
              <label className="mr-2 font-semibold">Học kỳ:</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="1">HK 1</option>
                <option value="2">HK 2</option>
              </select>
            </div>
            <div>
              <label className="mr-2 font-semibold">Khối:</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="border rounded px-2 py-1"
                disabled={isLoadingClasses || classes.length === 0}
              >
                <option value="all">Tất cả</option>
                {/* ✅ Tự động load khối từ danh sách lớp */}
                {Array.from(new Set(classes.map((c) => c.grade)))
                  .sort()
                  .map((grade) => (
                    <option key={grade} value={grade}>
                      Khối {grade}
                    </option>
                  ))}
              </select>
            </div>
            
            {/* ✅ Dialog tạo lịch tự động cho các lớp theo khối */}
            <GenerateScheduleDialog
              currentYear={selectedYear}
              currentSemester={selectedSemester}
              onSuccess={reloadSchedulesAfterGenerate}
              onGenerate={handleGenerateSchedule}
            />
            <GenerateScheduleDialog
              triggerLabel="🧠 Thuật toán Backtracking"
              generateButtonText="Chạy Backtracking"
              currentYear={selectedYear}
              currentSemester={selectedSemester}
              onSuccess={reloadSchedulesAfterGenerate}
              customGenerate={handleBacktrackingGenerate}
            />
            
            {/* ✅ Nút tạo lịch cho TẤT CẢ các lớp */}
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={async () => {
                if (!selectedYear || !selectedSemester) {
                  toast({
                    title: "⚠️ Thiếu thông tin",
                    description: "Vui lòng chọn năm học và học kỳ trước",
                    variant: "destructive"
                  });
                  return;
                }
                
                // ✅ Lấy tất cả các khối từ danh sách lớp
                const allGrades = Array.from(new Set(classes.map(c => c.grade).filter(Boolean))) as string[];
                
                if (allGrades.length === 0) {
                  toast({
                    title: "⚠️ Không có lớp",
                    description: "Không tìm thấy lớp nào để tạo lịch",
                    variant: "destructive"
                  });
                  return;
                }
                
                if (!window.confirm(
                  `Bạn có chắc muốn tạo thời khóa biểu tự động cho TẤT CẢ các lớp?\n\n` +
                  `- Năm học: ${selectedYear}\n` +
                  `- Học kỳ: ${selectedSemester}\n` +
                  `- Khối: ${allGrades.join(", ")}\n` +
                  `- Tổng số lớp: ${classes.length}\n\n` +
                  `⚠️ Lưu ý: Thời khóa biểu cũ của TẤT CẢ các lớp sẽ bị xóa và thay thế bằng lịch mới.`
                )) {
                  return;
                }
                
                try {
                  toast({
                    title: "⏳ Đang tạo lịch...",
                    description: `Đang tạo thời khóa biểu cho TẤT CẢ ${classes.length} lớp (${allGrades.length} khối)`,
                  });
                  
                  const result = await autoScheduleApi.generateSchedule(
                    allGrades,
                    selectedYear,
                    selectedSemester
                  );
                  
                  toast({
                    title: "✅ Thành công",
                    description: result.message || `Đã tạo thời khóa biểu cho ${result.schedules?.length || 0} lớp`,
                  });
                  
                  // ✅ Reload schedule nếu đang xem một lớp
                  if (selectedClassId) {
                    try {
                      const data = await scheduleApi.getScheduleByClass(
                        selectedClassId,
                        selectedYear,
                        selectedSemester
                      );
                      setSchedule(data || null);
                    } catch (err: any) {
                      if (err.response?.status !== 404) {
                        console.error("Lỗi khi reload schedule:", err);
                      }
                    }
                  }
                } catch (error: any) {
                  console.error("❌ Lỗi khi tạo lịch:", error);
                  toast({
                    title: "❌ Lỗi",
                    description: error.response?.data?.message || error.message || "Không thể tạo thời khóa biểu",
                    variant: "destructive"
                  });
                }
              }}
              disabled={!selectedYear || !selectedSemester || classes.length === 0}
              title="Tạo thời khóa biểu tự động cho TẤT CẢ các lớp trong năm học (sẽ xóa lịch cũ)"
            >
              🚀 Tạo lịch cho TẤT CẢ
            </Button>
            
            {/* ✅ Nút khóa tất cả lịch trong năm học + học kỳ */}
            {selectedYear && selectedSemester && (
              <Button
                variant="outline"
                className="border-green-600 text-green-700 hover:bg-green-50"
                disabled={classes.length === 0}
                onClick={async () => {
                  if (!selectedYear || !selectedSemester) {
                    toast({
                      title: "⚠️ Thiếu thông tin",
                      description: "Vui lòng chọn năm học và học kỳ trước",
                      variant: "destructive",
                    });
                    return;
                  }

                  const nextLockState = !allSchedulesLocked;

                  try {
                    toast({
                      title: nextLockState ? "⏳ Đang khóa lịch..." : "⏳ Đang mở khóa lịch...",
                      description: `${nextLockState ? "Đang khóa" : "Đang mở khóa"} tất cả thời khóa biểu trong ${selectedYear} - HK ${selectedSemester}`,
                    });

                    const result = await scheduleApi.lockAllSchedules(
                      selectedYear,
                      selectedSemester,
                      nextLockState
                    );

                    toast({
                      title: "✅ Thành công",
                      description:
                        result.message ||
                        (nextLockState
                          ? `Đã khóa toàn bộ thời khóa biểu trong ${selectedYear} - HK ${selectedSemester}`
                          : `Đã mở khóa toàn bộ thời khóa biểu trong ${selectedYear} - HK ${selectedSemester}`),
                    });

                    await loadScheduleStatus();
                    await reloadSchedulesAfterGenerate();
                  } catch (error: any) {
                    console.error("❌ Lỗi khi khóa/mở khóa lịch:", error);
                    toast({
                      title: "❌ Lỗi",
                      description:
                        error.response?.data?.message ||
                        error.message ||
                        "Không thể cập nhật trạng thái thời khóa biểu",
                      variant: "destructive",
                    });
                  }
                }}
              >
                {lockAllButtonLabel}
              </Button>
            )}
          </div>

          {/* Class list */}
          {isLoadingClasses ? (
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tải danh sách lớp...</span>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="mb-4 text-muted-foreground italic">
              {selectedYear ? `Không có lớp nào trong năm học ${selectedYear}` : "Vui lòng chọn năm học"}
            </div>
          ) : (() => {
            // ✅ Nhóm các lớp theo khối
            const classesByGrade = filteredClasses.reduce((acc, cls) => {
              const grade = cls.grade || "Khác";
              if (!acc[grade]) {
                acc[grade] = [];
              }
              acc[grade].push(cls);
              return acc;
            }, {} as Record<string, ClassType[]>);
            
            // ✅ Sắp xếp các khối theo thứ tự (10, 11, 12, ...)
            const sortedGrades = Object.keys(classesByGrade).sort((a, b) => {
              const numA = parseInt(a) || 999;
              const numB = parseInt(b) || 999;
              return numA - numB;
            });
            
            return (
              <Accordion
                type="multiple"
                value={openGrades}
                onValueChange={setOpenGrades}
                className="mb-4 space-y-2"
              >
                {sortedGrades.map((grade) => {
                  const gradeClasses = classesByGrade[grade];
                  return (
                    <AccordionItem key={grade} value={grade} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">Khối {grade}</span>
                          <span className="text-sm text-muted-foreground">
                            ({gradeClasses.length} lớp)
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                          {gradeClasses.map((cls) => {
                            const classIdStr = cls._id.toString();
                            const scheduleStatus = scheduleStatusMap[classIdStr];
                            const hasSchedule = scheduleStatus?.hasSchedule || false;
                            const isLocked = scheduleStatus?.isLocked || false;
                            
                            return (
                              <div
                                key={cls._id}
                                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                                  selectedClassId === cls._id
                                    ? "border-blue-500 bg-blue-50 shadow-md"
                                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                                }`}
                              >
                                <button
                                  className={`flex-1 text-left ${
                                    selectedClassId === cls._id ? "text-blue-700 font-semibold" : "text-gray-700"
                                  }`}
                                  onClick={() => setSelectedClassId(cls._id)}
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className={`h-4 w-4 ${selectedClassId === cls._id ? "text-blue-600" : "text-gray-500"}`} />
                                    <span className="font-medium">{cls.className}</span>
                                    {/* ✅ Badge trạng thái lịch học */}
                                    {hasSchedule ? (
                                      <div className="flex items-center gap-1">
                                        <CheckCircle2 className={`h-3.5 w-3.5 ${isLocked ? "text-green-600" : "text-blue-600"}`} />
                                        {isLocked && <Lock className="h-3 w-3 text-green-600" />}
                                      </div>
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground ml-6">Khối {cls.grade}</span>
                                    {hasSchedule && (
                                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        isLocked 
                                          ? "bg-green-100 text-green-700" 
                                          : "bg-blue-100 text-blue-700"
                                      }`}>
                                        {isLocked ? "Đã khóa" : "Chưa khóa"}
                                      </span>
                                    )}
                                    {!hasSchedule && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                        Chưa có lịch
                                      </span>
                                    )}
                                  </div>
                                </button>
                              {isLocked ? (
                                <div className="flex items-center gap-1 text-green-600 text-sm ml-3">
                                  <Lock className="h-4 w-4" />
                                  <span>Đã khóa</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-yellow-600 text-sm ml-3">
                                  <Unlock className="h-4 w-4" />
                                  <span>Chưa khóa</span>
                                </div>
                              )}
                              
                              {/* ✅ Nút tạo thời khóa biểu + nút khóa nhanh */}
                              <div className="flex items-center gap-2 ml-2">
                                <Button
                                  variant={selectedClassId === cls._id ? "default" : "outline"}
                                  size="sm"
                                  className={`${isLocked ? "opacity-40 pointer-events-none" : ""}`}
                                  onClick={() => {
                                    if (!selectedYear || !selectedSemester || isLocked) {
                                      return;
                                    }
                                    
                                    // ✅ Mở AlertDialog thay vì window.confirm
                                    setPendingClass({ id: cls._id, name: cls.className });
                                    setConfirmDialogOpen(true);
                                  }}
                                  disabled={isLocked || !selectedYear || !selectedSemester}
                                  title={
                                    isLocked
                                      ? "Lớp đã khóa thời khóa biểu, không thể tạo lại."
                                      : "Tạo thời khóa biểu tự động cho lớp này (sẽ xóa lịch cũ)"
                                  }
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Tạo TKB
                                </Button>
                                <Button
                                  variant={isLocked ? "default" : "outline"}
                                  size="icon"
                                  className={`${!hasSchedule ? "opacity-40 cursor-not-allowed" : ""}`}
                                  disabled={!hasSchedule || lockingClassId === classIdStr}
                                  onClick={() => handleToggleClassLock(classIdStr, cls.className, scheduleStatus)}
                                  title={
                                    !hasSchedule
                                      ? "Chưa có thời khóa biểu để khóa/mở khóa."
                                      : isLocked
                                      ? "Mở khóa thời khóa biểu của lớp này."
                                      : "Khóa thời khóa biểu của lớp này."
                                  }
                                >
                                  {lockingClassId === classIdStr ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : isLocked ? (
                                    <Unlock className="h-4 w-4" />
                                  ) : (
                                    <Lock className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            );
          })()}

          {/* Schedule grid */}
          {schedule && scheduleConfig ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">
                    Thời khóa biểu lớp {schedule.className} ({schedule.year} - HK {schedule.semester})
                  </h2>
                  {semesterDates.startDate && semesterDates.endDate && (
                    <p className="text-sm text-muted-foreground mt-1">
                      📅 {new Date(semesterDates.startDate).toLocaleDateString('vi-VN')} - {new Date(semesterDates.endDate).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleSaveSchedule}
                    disabled={schedule.isLocked === true}
                    title={schedule.isLocked === true ? "Thời khóa biểu đã khóa. Vui lòng mở khóa trước khi chỉnh sửa." : ""}
                  >
                    <Save className="h-4 w-4 mr-2" /> Lưu thời khóa biểu
                  </Button>
                  {schedule?._id && (
                    <Button 
                      variant={schedule.isLocked ? "default" : "outline"}
                      onClick={async () => {
                        if (!schedule?._id) return;
                        try {
                          const newLockStatus = !schedule.isLocked;
                          await scheduleApi.lockSchedule(schedule._id, newLockStatus);
                          setSchedule({ ...schedule, isLocked: newLockStatus });
                          toast({
                            title: newLockStatus ? "🔒 Đã khóa" : "🔓 Đã mở khóa",
                            description: newLockStatus 
                              ? "Học sinh và giáo viên có thể xem thời khóa biểu này."
                              : "Thời khóa biểu đã được mở khóa. Học sinh và giáo viên không thể xem.",
                          });
                        } catch (err: any) {
                          console.error("Lỗi khóa/mở khóa:", err);
                          toast({
                            title: "❌ Lỗi",
                            description: err.response?.data?.message || "Không thể khóa/mở khóa thời khóa biểu",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      {schedule.isLocked ? (
                        <>
                          <Lock className="h-4 w-4 mr-2" /> Đã khóa
                        </>
                      ) : (
                        <>
                          <Unlock className="h-4 w-4 mr-2" /> Chưa khóa
                        </>
                      )}
                    </Button>
                  )}
                  <DeleteScheduleDialog 
                    onDeleted={() => setSchedule(null)} 
                    disabled={schedule.isLocked === true}
                  />
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="flex gap-4">
                  {/* Sidebar */}
                  <div className="w-[220px] p-2 border rounded bg-gray-50 flex flex-col items-center">
                    <h3 className="font-semibold mb-2">Môn học chưa xếp</h3>
                    <SortableContext
                      items={getUnassignedSubjects().map(s => `unassigned-${s.subject}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {getUnassignedSubjects().map(s => (
                        <SortableCell key={`unassigned-${s.subject}`} id={`unassigned-${s.subject}`}>
                          <UnassignedSubjectItem subject={s.subject} teacher={s.teacher} />
                        </SortableCell>
                      ))}
                    </SortableContext>
                  </div>

                  {/* Grid */}
                  <div className="flex-1 overflow-x-auto overflow-visible">
                    <div className="grid border rounded-lg overflow-hidden">
                      <div className="grid grid-cols-[120px_repeat(auto-fill,minmax(140px,1fr))] bg-gray-100 font-semibold">
                        <div className="p-3 text-center border-r">Tiết (Giờ)</div>
                        {days.map((d) => (
                          <div key={d.key} className="p-3 text-center border-r last:border-r-0">
                            {d.label}
                          </div>
                        ))}
                      </div>

                      {/* Morning */}
                      <div className="col-span-full bg-blue-50 text-center font-bold py-2">🌅 Buổi sáng</div>
                      {Array.from({ length: scheduleConfig.days.Monday.morningPeriods }, (_, idx) => {
                        const periodIdx = idx;
                        const time = getPeriodTime(scheduleConfig, idx, "morning");
                        return (
                          <div
                            key={`morning-${idx}`}
                            className="grid grid-cols-[120px_repeat(auto-fill,minmax(140px,1fr))] border-t"
                          >
                            <div className="p-2 text-sm text-center border-r font-medium bg-gray-50">
                              {periodIdx + 1} <br />
                              <span className="text-xs text-gray-500">{time}</span>
                            </div>
                            <SortableContext
                              items={days.map((d) => `${d.key}-${periodIdx}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              {days.map((d) => {
                                const dayEntry = schedule.timetable.find((x) => x.day === d.key);
                                const p = dayEntry?.periods[periodIdx];
                                return (
                                  <SortableCell key={`${d.key}-${periodIdx}`} id={`${d.key}-${periodIdx}`}>
                                    <ScheduleGridCell
                                      p={p}
                                      isAfternoon={false}
                                      assignments={assignments}
                                      onTeacherChange={(t) => handleTeacherChange(d.key, periodIdx, t)}
                                    />
                                  </SortableCell>
                                );
                              })}
                            </SortableContext>
                          </div>
                        );
                      })}

                      {/* Afternoon */}
                      <div className="col-span-full bg-orange-50 text-center font-bold py-2">🌇 Buổi chiều</div>
                      {Array.from({ length: scheduleConfig.days.Monday.afternoonPeriods }, (_, idx) => {
                        const periodIdx = idx + scheduleConfig.days.Monday.morningPeriods;
                        const time = getPeriodTime(scheduleConfig, idx, "afternoon");
                        return (
                          <div
                            key={`afternoon-${idx}`}
                            className="grid grid-cols-[120px_repeat(auto-fill,minmax(140px,1fr))] border-t"
                          >
                            <div className="p-2 text-sm text-center border-r font-medium bg-gray-50">
                              {periodIdx + 1} <br />
                              <span className="text-xs text-gray-500">{time}</span>
                            </div>
                            <SortableContext
                              items={days.map((d) => `${d.key}-${periodIdx}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              {days.map((d) => {
                                const dayEntry = schedule.timetable.find((x) => x.day === d.key);
                                const p = dayEntry?.periods[periodIdx];
                                return (
                                  <SortableCell key={`${d.key}-${periodIdx}`} id={`${d.key}-${periodIdx}`}>
                                    <ScheduleGridCell
                                      p={p}
                                      isAfternoon={true}
                                      assignments={assignments}
                                      onTeacherChange={(t) => handleTeacherChange(d.key, periodIdx, t)}
                                    />
                                  </SortableCell>
                                );
                              })}
                            </SortableContext>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </DndContext>
            </div>
          ) : (
            <p className="mt-4 text-gray-500 italic">Chọn lớp để xem thời khóa biểu.</p>
          )}
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <Button variant="outline" className="mb-4">
            <BookOpen className="h-4 w-4 mr-2" /> Cấu hình thời khóa biểu
          </Button>
          <ScheduleConfigForm />
        </TabsContent>
      </Tabs>

      {/* ✅ AlertDialog xác nhận tạo TKB cho 1 lớp */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Xác nhận tạo thời khóa biểu</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Bạn có chắc muốn tạo thời khóa biểu tự động cho lớp <strong>{pendingClass?.name}</strong>?</p>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                <p className="text-sm font-semibold text-yellow-800">⚠️ Lưu ý quan trọng:</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Thời khóa biểu cũ của lớp này sẽ bị <strong>xóa hoàn toàn</strong> và thay thế bằng lịch mới được tạo tự động.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingClass || !selectedYear || !selectedSemester) return;
                
                setConfirmDialogOpen(false);
                
                try {
                  toast({
                    title: "⏳ Đang tạo lịch...",
                    description: `Đang tạo thời khóa biểu cho lớp ${pendingClass.name}`,
                  });
                  
                  const result = await autoScheduleApi.generateScheduleForSingleClass(
                    pendingClass.id,
                    selectedYear,
                    selectedSemester
                  );
                  
                  toast({
                    title: "✅ Thành công",
                    description: result.message || `Đã tạo thời khóa biểu cho lớp ${pendingClass.name}`,
                  });
                  
                  // ✅ Load lại lịch nếu đang xem lớp này
                  if (selectedClassId === pendingClass.id) {
                    const data = await scheduleApi.getScheduleByClass(
                      pendingClass.id,
                      selectedYear,
                      selectedSemester
                    );
                    setSchedule(data || null);
                  }
                  
                  setPendingClass(null);
                } catch (error: any) {
                  console.error("❌ Lỗi khi tạo lịch:", error);
                  toast({
                    title: "❌ Lỗi",
                    description: error.response?.data?.message || error.message || "Không thể tạo thời khóa biểu",
                    variant: "destructive"
                  });
                  setPendingClass(null);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Xác nhận tạo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

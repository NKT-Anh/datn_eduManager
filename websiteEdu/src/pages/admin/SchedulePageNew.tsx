import React, { useEffect, useRef, useState } from "react";
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
import { BookOpen, Save } from "lucide-react";

// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSubjects, useAssignments, useSchoolYears } from "@/hooks";
import { scheduleApi } from "@/services/scheduleApi";
import { getScheduleConfig } from "@/services/scheduleConfigApi";
import { classApi } from "@/services/classApi";
import DeleteScheduleDialog from "@/components/dialogs/DeleteScheduleSection";
import { Subject, ClassType, TeachingAssignment } from "@/types/class";
import { ScheduleConfig, ClassSchedule } from "@/types/schedule";
import { ScheduleConfigForm } from "@/components/forms/ScheduleConfigForm";
import { toast } from "@/components/ui/use-toast";
import { Teacher } from "@/types/auth";
import { Loader2 } from "lucide-react";
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

  return (
    <TableCell
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-move relative overflow-visible"
    >
      {children}
    </TableCell>
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

  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("1");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const [days, setDays] = useState<{ key: string; label: string }[]>([]);
  const sensors = useSensors(useSensor(PointerSensor));

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
      } catch (err) {
        console.error("Lỗi tải thời khóa biểu:", err);
        setSchedule(null);
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

    const newSchedule = { ...schedule };

    if (active.id.toString().startsWith("unassigned-")) {
      const subject = active.id.toString().replace("unassigned-", "");
      const [day, idx] = over.id.toString().split("-");
      const dayEntry = newSchedule.timetable.find(d => d.day === day);
      if (!dayEntry) return;
      dayEntry.periods[+idx] = { period: +idx, subject, teacher: undefined };
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

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    try {
      await scheduleApi.saveOrUpdateSchedule({
        ...schedule,
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: "✅ Lưu thành công",
        description: `Thời khóa biểu lớp ${schedule.className} đã được cập nhật.`,
      });
    } catch (err) {
      console.error("Lỗi lưu thời khóa biểu:", err);
      toast({
        title: "❌ Lỗi lưu",
        description: "Không thể lưu thời khóa biểu. Vui lòng thử lại.",
        variant: "destructive",
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

    const unassigned: { subject: string; remaining: number }[] = [];

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
        unassigned.push({ subject: subjectName, remaining });
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

  const UnassignedSubjectItem = ({ subject }: { subject: string }) => {
    return (
      <div
        className="cursor-move px-4 py-2 mb-2 rounded shadow text-white text-center"
        style={{ backgroundColor: getSubjectColor(subject) }}
      >
        {subject}
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
          ) : (
            <ul className="flex flex-wrap gap-2 mb-4">
              {filteredClasses.map((cls) => (
                <li key={cls._id}>
                  <button
                    className={`px-4 py-2 rounded border ${
                      selectedClassId === cls._id ? "bg-blue-600 text-white" : "bg-gray-100"
                    }`}
                    onClick={() => setSelectedClassId(cls._id)}
                  >
                    {cls.className} (Khối {cls.grade})
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Schedule grid */}
          {schedule && scheduleConfig ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  Thời khóa biểu lớp {schedule.className} ({schedule.year} - HK {schedule.semester})
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSaveSchedule}>
                    <Save className="h-4 w-4 mr-2" /> Lưu thời khóa biểu
                  </Button>
                  <DeleteScheduleDialog onDeleted={() => setSchedule(null)} />
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
                          <UnassignedSubjectItem subject={s.subject} />
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
    </div>
  );
}

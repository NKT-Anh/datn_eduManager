import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BookOpen } from "lucide-react";

// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSubjects, useClasses, useAssignments } from "@/hooks";
import { scheduleApi } from "@/services/scheduleApi";
import { getScheduleConfig } from "@/services/scheduleConfigApi";
import { autoGenerateSchedule } from "@/services/smartSystem/autoGenerateSchedule";

import {
  Subject,
  ClassType,
  TeachingAssignment,
} from "@/types/class";
import {
  ScheduleConfig,
  ClassSchedule,
  SchedulePayload,
} from "@/types/schedule";

import { GenerateScheduleDialog } from "@/components/dialogs/GenerateScheduleDialog";
import { ScheduleConfigForm } from "@/components/forms/ScheduleConfigForm";
import DragDropSchedule from "@/components/schedule/DragDropSchedule";
import ModernTimetable from "@/components/schedule/ModernTimetable";
import CreateClassesDialog from "@/components/dialogs/CreateClassesDialog";
import ScheduleHeader from "@/components/schedule/ScheduleHeader";
import { autoScheduleApi } from "@/services/autoScheduleApi";
import { constraintSolverApi } from "@/services/constraintSolverApi";

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export default function SchedulePage() {
  // --- STATE ---
  // ✅ Sử dụng hooks
  const { subjects } = useSubjects();
  const { classes } = useClasses();
  const { assignments } = useAssignments();
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(
    null
  );
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("1");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [days, setDays] = useState<string[]>([]);
  const [useModernUI, setUseModernUI] = useState<boolean>(true);
  const [includeActivities, setIncludeActivities] = useState<boolean>(true);


  // ✅ Không cần fetch nữa vì đã dùng hooks
  // Tự tính năm học hiện tại
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    setSelectedYear(
      month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`
    );
  }, []);

  // --- FETCH CẤU HÌNH TKB ---
  useEffect(() => {
    const fetchScheduleConfig = async () => {
      try {
        const configRes = await getScheduleConfig();
        setScheduleConfig(configRes);

        if (configRes?.days) {
          const dayNames = Object.keys(configRes.days).map((key) => {
            switch (key) {
              case "Monday":
                return "Thứ 2";
              case "Tuesday":
                return "Thứ 3";
              case "Wednesday":
                return "Thứ 4";
              case "Thursday":
                return "Thứ 5";
              case "Friday":
                return "Thứ 6";
              case "Saturday":
                return "Thứ 7";
              case "Sunday":
                return "Chủ nhật";
              default:
                return key;
            }
          });
          setDays(dayNames);
        }
      } catch (err) {
        console.error("Lỗi load cấu hình TKB:", err);
      }
    };
    fetchScheduleConfig();
  }, []);

  // --- TẢI THỜI KHÓA BIỂU KHI THAY ĐỔI NĂM HỌC/HỌC KỲ ---
  useEffect(() => {
    if (selectedYear && selectedSemester) {
      loadSchedules(selectedYear, selectedSemester);
    }
  }, [selectedYear, selectedSemester]);

  const PERIODS_PER_DAY =
  scheduleConfig?.days &&
  (scheduleConfig.days["Monday"]?.totalPeriods ??
    Object.values(scheduleConfig.days)[0]?.totalPeriods ??
    5);


  const filteredClasses =
    selectedGrade === "all"
      ? classes
      : classes.filter((c) => c.grade === selectedGrade);

  // --- HÀM SINH TỰ ĐỘNG ---
  // const handleGenerateSchedule = async (
  //   targetGrades: string[],
  //   year: string,
  //   semester: string
  // ) => {
  //   if (!scheduleConfig) return alert("Chưa có cấu hình thời khóa biểu!");

  //   try {
  //     // Sử dụng API mới để tạo thời khóa biểu
  //     const result = await autoScheduleApi.generateSchedule(
  //       targetGrades,
  //       year,
  //       semester,
  //       includeActivities
  //     );
      
      
  //     // Tải lại danh sách thời khóa biểu
  //     await loadSchedules(year, semester);
      
  //     alert(`✅ Đã tạo & lưu lịch cho ${result.schedules.length} lớp.`);
  //   } catch (err) {
  //     console.error("❌ Lỗi tạo thời khóa biểu:", err);
  //     alert("Lỗi khi tạo thời khóa biểu!");
  //   }
  // };

  const handleGenerateSchedule = async (
    targetGrades: string[],
    year: string,
    semester: string
  ) => {
    if (!scheduleConfig) return alert("Chưa có cấu hình thời khóa biểu!");
  
    try {
      console.log("📤 Dữ liệu gửi lên autoScheduleApi.generateSchedule:", {
        targetGrades,
        year,
        semester,
        includeActivities,
      });
  
      const result = await autoScheduleApi.generateSchedule(
        targetGrades,
        year,
        semester,
        includeActivities
      );
      
      console.log("📥 Kết quả trả về từ backend:", result);
  
      await loadSchedules(year, semester);
      alert(`✅ Đã tạo & lưu lịch cho ${result.schedules.length} lớp.`);
    } catch (err) {
      console.error("❌ Lỗi tạo thời khóa biểu:", err);
      alert("Lỗi khi tạo thời khóa biểu!");
      (err as any).__handled = true;
      throw err;
    }
  };
  
  // --- HÀM SINH TỰ ĐỘNG ---
// const handleGenerateSchedule = async (
//   targetGrades: string[],
//   year: string,
//   semester: string
// ) => {
//   if (!scheduleConfig) return alert("⚠️ Chưa có cấu hình thời khóa biểu!");

//   try {
//     console.log("🚀 Bắt đầu sinh thời khóa biểu toàn trường...");
//     console.log({
//       targetGrades,
//       year,
//       semester,
//       includeActivities,
//     });

//     // Lọc danh sách lớp theo khối được chọn
//     const targetClasses = classes.filter((c) =>
//       targetGrades.includes(c.grade)
//     );

//     // ⚡ Gọi hàm sinh lịch tự động toàn trường
//     const generatedSchedules = autoGenerateSchedule(
//       scheduleConfig,
//       subjects,
//       targetClasses,
//       assignments,
//       year,
//       semester
//     );

//     console.log("✅ Kết quả sinh lịch:", generatedSchedules);

//     // Lưu từng thời khóa biểu vào Mongo
//     for (const schedule of generatedSchedules) {
//       const payload: SchedulePayload = {
//         classId: schedule.classId,
//         timetable: schedule.timetable,
//         year: schedule.year,
//         semester: schedule.semester,
//       };
//       await scheduleApi.saveSchedule(payload);
//     }

//     await loadSchedules(year, semester);
//     alert(`✅ Đã tạo & lưu lịch cho ${generatedSchedules.length} lớp.`);
//   } catch (err) {
//     console.error("❌ Lỗi khi sinh thời khóa biểu:", err);
//     alert("Lỗi khi tạo thời khóa biểu!");
//   }
// };


  // --- HÀM TẢI THỜI KHÓA BIỂU ---
  const loadSchedules = async (year: string, semester: string) => {
    try {
      const schedulesRes = await scheduleApi.getSchedulesByYearSemester(year, semester);
      setSchedules(schedulesRes);
    } catch (err) {
      console.error("Lỗi tải thời khóa biểu:", err);
    }
  };

  // --- HÀM CẬP NHẬT THỜI KHÓA BIỂU ---
  const handleScheduleUpdate = (updatedSchedule: ClassSchedule) => {
    setSchedules(prev => 
      prev.map(s => 
        s.classId === updatedSchedule.classId && 
        s.year === updatedSchedule.year && 
        s.semester === updatedSchedule.semester 
          ? updatedSchedule 
          : s
      )
    );
  };

  // --- HÀM LƯU THỜI KHÓA BIỂU ---
  const handleSaveSchedule = async (schedule: ClassSchedule) => {
    try {
      const payload: SchedulePayload = {
        classId: schedule.classId,
        timetable: schedule.timetable,
        year: schedule.year,
        semester: schedule.semester,
      };
      console.log("📤 Dữ liệu gửi lên scheduleApi.saveSchedule:", payload);

      await scheduleApi.saveSchedule(payload);
      alert("✅ Đã lưu thời khóa biểu thành công!");
    } catch (err) {
      console.error("❌ Lỗi lưu thời khóa biểu:", err);
      alert("Lỗi khi lưu thời khóa biểu!");
    }
  };

  // --- HÀM TẢI LẠI DANH SÁCH LỚP ---
  const handleClassesCreated = async () => {
    try {
      // ✅ Không cần fetch nữa vì đã dùng hooks
    } catch (err) {
      console.error("Lỗi tải danh sách lớp:", err);
    }
  };

  // --- CHỌN LỚP ---
  const selectedSchedule = schedules.find(
    (s) =>
      s.classId === selectedClassId &&
      s.year === selectedYear &&
      s.semester === selectedSemester
  );

  // --- HÀM TÍNH GIỜ BẮT ĐẦU / KẾT THÚC ---
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
      totalMinutes += specialBreak
        ? specialBreak.minutes
        : config.defaultBreakMinutes;
    }

    const startHour = Math.floor(totalMinutes / 60);
    const startMinute = totalMinutes % 60;
    const endMinutes = totalMinutes + config.minutesPerPeriod;
    const endHour = Math.floor(endMinutes / 60);
    const endMinute = endMinutes % 60;

    return `${String(startHour).padStart(2, "0")}:${String(
      startMinute
    ).padStart(2, "0")} - ${String(endHour).padStart(2, "0")}:${String(
      endMinute
    ).padStart(2, "0")}`;
  };

  // --- ĐẾM SỐ TIẾT / MÔN ---
  const subjectCounts: Record<string, number> = {};
  if (selectedSchedule) {
    for (const entry of selectedSchedule.timetable) {
      entry.periods.forEach((p) => {
        if (!p.subject) return;
        subjectCounts[p.subject] = (subjectCounts[p.subject] || 0) + 1;
      });
    }
  }

  const sortedSubjectCounts = Object.entries(subjectCounts).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  // --- GIAO DIỆN ---
  return (
    <div className="p-6 space-y-6">
      <ScheduleHeader
        title="📘 Quản lý Thời khóa biểu"
        description="Theo dõi, cấu hình và tạo thời khóa biểu phù hợp cho từng lớp trong năm học."
      />

      <Tabs defaultValue="classes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="classes">Thời khóa biểu</TabsTrigger>
          <TabsTrigger value="config">Cấu hình</TabsTrigger>
        </TabsList>

        {/* TAB 1: DANH SÁCH LỚP */}
        <TabsContent value="classes" className="mt-4">
          {/* Bộ lọc */}
          <div className="flex gap-4 mb-4">
            <div>
              <label className="mr-2 font-semibold">Năm học:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border rounded px-2 py-1"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  const label = `${year - 1}-${year}`;
                  return (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  );
                })}
              </select>
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
              >
                <option value="all">Tất cả</option>
                <option value="10">Khối 10</option>
                <option value="11">Khối 11</option>
                <option value="12">Khối 12</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={includeActivities}
    onChange={(e) => setIncludeActivities(e.target.checked)}
  />
  <label className="text-sm font-medium">Bao gồm hoạt động</label>
</div>


            {/* Dialog tạo lịch */}
            <GenerateScheduleDialog
              currentYear={selectedYear}
              currentSemester={selectedSemester}
              onSuccess={async () => {
                // ✅ Reload schedules sau khi tạo thành công
                if (selectedYear && selectedSemester) {
                  await loadSchedules(selectedYear, selectedSemester);
                }
              }}
              onGenerate={(grades, year, semester) => {
                // ✅ Fallback: Nếu có callback cũ, vẫn hỗ trợ
                setSelectedYear(year);
                setSelectedSemester(semester);
                handleGenerateSchedule(grades, year, semester);
              }}
            />

            {/* Dialog tạo lớp */}
            <CreateClassesDialog onClassesCreated={handleClassesCreated} />
          </div>

          {/* Danh sách lớp */}
          <ul className="flex flex-wrap gap-2">
            {filteredClasses.map((cls) => (
              <li key={cls._id}>
                <button
                  className={`px-4 py-2 rounded border ${
                    selectedClassId === cls._id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100"
                  }`}
                  onClick={() => setSelectedClassId(cls._id)}
                >
                  {cls.className} (Khối {cls.grade})
                </button>
              </li>
            ))}
          </ul>

          {/* Toggle UI */}
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useModernUI}
                onChange={(e) => setUseModernUI(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">Giao diện mới (Tối ưu)</span>
            </label>
          </div>

          {/* Hiển thị TKB với kéo thả */}
          <div className="mt-4">
            {useModernUI ? (
              <ModernTimetable
                schedule={selectedSchedule}
                scheduleConfig={scheduleConfig}
                onScheduleUpdate={handleScheduleUpdate}
                onSave={handleSaveSchedule}
                onGenerateSchedule={handleGenerateSchedule}
                classes={classes}
                selectedYear={selectedYear}
                selectedSemester={selectedSemester}
              />
            ) : (
              <DragDropSchedule
                schedule={selectedSchedule}
                scheduleConfig={scheduleConfig}
                onScheduleUpdate={handleScheduleUpdate}
                onSave={handleSaveSchedule}
              />
            )}
          </div>
        </TabsContent>

        {/* TAB 2: CẤU HÌNH */}
        <TabsContent value="config" className="mt-4">
          <Button variant="outline" className="mb-4">
            <BookOpen className="h-4 w-4 mr-2" />
            Cấu hình thời khóa biểu
          </Button>
          <ScheduleConfigForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { studentExamApi, StudentExam, StudentExamGrade, StudentExamSchedule } from "@/services/exams/studentExamApi";
import { Calendar, BookOpen, User, Award } from "lucide-react";
import { Select, Spin, Empty } from "antd";

export default function StudentExamGradesSearchPage() {
  const { backendUser } = useAuth();
  const studentId = backendUser?.studentId || backendUser?._id;

  const [exams, setExams] = useState<StudentExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [grades, setGrades] = useState<StudentExamGrade[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [schedules, setSchedules] = useState<StudentExamSchedule[]>([]);

  useEffect(() => {
    const fetchExams = async () => {
      if (!studentId) return;
      setLoadingExams(true);
      try {
        const list = await studentExamApi.getExams(String(studentId));
        // Only published, sort newest first
        const published = (list || []).filter((e: any) => e.status === "published");
        published.sort((a: any, b: any) => {
          const ad = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bd = b.startDate ? new Date(b.startDate).getTime() : 0;
          return bd - ad;
        });
        setExams(published);
        if (published.length > 0) {
          setSelectedExamId(published[0]._id);
        }
      } catch {
        setExams([]);
      } finally {
        setLoadingExams(false);
      }
    };
    fetchExams();
  }, [studentId]);

  useEffect(() => {
    const fetchGrades = async () => {
      if (!studentId || !selectedExamId) {
        setGrades([]);
        setSchedules([]);
        return;
      }
      setLoadingGrades(true);
      try {
        const [gradesRes, schedulesRes] = await Promise.all([
          studentExamApi.getGrades(selectedExamId, String(studentId)),
          studentExamApi.getSchedules(selectedExamId, String(studentId)),
        ]);
        setGrades(Array.isArray(gradesRes) ? gradesRes : []);
        setSchedules(Array.isArray(schedulesRes) ? schedulesRes : []);
      } catch {
        setGrades([]);
        setSchedules([]);
      } finally {
        setLoadingGrades(false);
      }
    };
    fetchGrades();
  }, [studentId, selectedExamId]);

  const selectedExam = useMemo(() => exams.find(e => e._id === selectedExamId), [exams, selectedExamId]);

  const scoreBg = (val?: number | null) => {
    if (val == null) return "bg-gray-100 text-gray-600";
    if (val >= 9) return "bg-emerald-100 text-emerald-700"; // 9+: xanh lá
    if (val >= 8) return "bg-sky-100 text-sky-700"; // 8.0-8.9: xanh dương
    if (val >= 6.5) return "bg-amber-100 text-amber-700"; // 6.5-7.9: vàng
    return "bg-rose-100 text-rose-700"; // dưới 6.5: đỏ
  };

  const typeLabel = (t?: string) => t === "midterm" ? "Giữa kỳ" : t === "final" ? "Cuối kỳ" : "Kỳ thi";
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("vi-VN") : "-";

  // Map subjectId to exam date (first matching schedule date)
  const subjectDateMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of schedules || []) {
      const sid = s.subject?._id;
      if (sid && !map[sid]) {
        map[sid] = s.date;
      }
    }
    return map;
  }, [schedules]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Điểm thi của tôi</h1>
        <p className="text-sm text-muted-foreground">Chỉ hiển thị điểm thi của chính bạn theo từng kỳ thi</p>
      </div>

      {/* Exam selector */}
      <div className="rounded-xl border bg-white p-4 shadow-sm mb-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Chọn kỳ thi</div>
            <Select
              value={selectedExamId || undefined}
              onChange={(v) => setSelectedExamId(String(v))}
              placeholder="Chọn kỳ thi"
              style={{ minWidth: 260 }}
              showSearch
              loading={loadingExams}
              filterOption={(input, option) => {
                const label = String(option?.children || option?.label || "");
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {exams.map((ex: any) => (
                <Select.Option key={ex._id} value={ex._id}>
                  {ex.name} • {ex.year} • HK{ex.semester} • {typeLabel((ex as any).type)}
                </Select.Option>
              ))}
            </Select>
          </div>
          {selectedExam && (
            <div className="text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-violet-100 text-violet-700">
                  <BookOpen className="h-4 w-4" /> {typeLabel((selectedExam as any).type)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-700">
                  <Calendar className="h-4 w-4" /> {fmtDate((selectedExam as any).startDate)} - {fmtDate((selectedExam as any).endDate)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grades list */}
      <Spin spinning={loadingGrades}>
        {!selectedExamId ? (
          <div className="rounded-lg border p-6 text-center text-sm text-gray-500">Vui lòng chọn kỳ thi</div>
        ) : grades.length === 0 ? (
          <Empty description="Chưa có dữ liệu điểm cho kỳ thi này" />
        ) : (
          <div className="rounded-2xl border bg-white p-3 sm:p-4 shadow-sm">
            <div className="text-sm font-semibold mb-2 sm:mb-3">Chi tiết điểm thi</div>
            <div className="space-y-2">
              {grades.map((g, idx) => {
                const dateStr = subjectDateMap[g.subject?._id || ""];
                return (
                  <div key={`${g._id || idx}`} className="rounded-xl bg-muted/60 border border-border px-3 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium truncate">{g.subject?.name || "Môn học"}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{dateStr ? new Date(dateStr).toLocaleDateString("vi-VN") : "-"}</div>
                    </div>
                    <div className={`ml-3 min-w-[48px] text-right px-2 py-1 rounded-md text-base font-semibold ${scoreBg(g.gradeValue)}`}>
                      {g.gradeValue != null ? Number(g.gradeValue).toString().replace(/\.0$/, '') : "-"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Spin>
    </div>
  );
}

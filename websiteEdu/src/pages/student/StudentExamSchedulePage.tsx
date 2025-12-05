import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { studentExamApi, StudentExam, StudentExamSchedule, StudentExamRoom } from '@/services/exams/studentExamApi';
import { Calendar, FileText, ChevronDown } from 'lucide-react';
import StudentScheduleLegacy from './exams/StudentSchedule';

export default function StudentExamSchedulePage() {
  const { backendUser } = useAuth();
  const [exams, setExams] = useState<StudentExam[]>([]);
  const [schedulesMap, setSchedulesMap] = useState<Record<string, StudentExamSchedule[]>>({});
  const [roomsMap, setRoomsMap] = useState<Record<string, Record<string, StudentExamRoom>>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const studentId = backendUser?.studentId || backendUser?._id;

  useEffect(() => {
    const loadExams = async () => {
      if (!studentId) return;
      try {
        const list = await studentExamApi.getExams(String(studentId));
        // Chỉ lấy kỳ thi đã công bố và không quá 15 ngày sau khi kết thúc
        const now = new Date();
        const fifteenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15).getTime();
        const published = (list || []).filter((e: any) => e.status === 'published')
          .filter((e: any) => {
            if (!e.endDate) return true;
            const end = new Date(e.endDate).getTime();
            return end >= fifteenDaysAgo;
          });
        const finalList = published.sort((a: any, b: any) => {
          const ad = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bd = b.startDate ? new Date(b.startDate).getTime() : 0;
          return bd - ad;
        });
        setExams(finalList);
        // Prefetch schedules for counts/progress
        const map: Record<string, StudentExamSchedule[]> = {};
        for (const ex of finalList) {
          try {
            const data = await studentExamApi.getSchedules(ex._id, String(studentId));
            map[ex._id] = (data || []).sort((a: any, b: any) => {
              const dateA = a.date ? new Date(a.date).getTime() : 0;
              const dateB = b.date ? new Date(b.date).getTime() : 0;
              if (dateA !== dateB) return dateA - dateB;
              return String(a.startTime || '').localeCompare(String(b.startTime || ''));
            });
          } catch {
            map[ex._id] = [];
          }
        }
        setSchedulesMap(map);
      } catch {
        setExams([]);
      }
    };
    loadExams();
  }, [studentId]);

  // Lazy load room info when expanding an exam
  const ensureRoomsForExam = async (examId: string) => {
    if (!studentId) return;
    if (roomsMap[examId]) return; // already loaded
    const list = schedulesMap[examId] || [];
    const map: Record<string, StudentExamRoom> = {};
    for (const s of list) {
      // Chỉ gọi khi đã có seatNumber (tránh 404 khi chưa xếp)
      if (!s.seatNumber) continue;
      try {
        const r = await studentExamApi.getRoom(s._id, String(studentId));
        map[s._id] = r as any;
      } catch {
        // ignore missing room
      }
    }
    setRoomsMap(prev => ({ ...prev, [examId]: map }));
  };

  const examOptions = useMemo(() => exams.map(e => ({ value: e._id, label: `${e.name}` })), [exams]);

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : '-';
  const getDuration = (start?: string, end?: string) => {
    if (!start || !end) return '-';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if ([sh, sm, eh, em].some(v => isNaN(v))) return '-';
    let minutes = (eh * 60 + em) - (sh * 60 + sm);
    if (minutes <= 0) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h}h${m ? m : ''}` : `${m} phút`;
  };

  const isToday = (d?: string) => {
    if (!d) return false;
    const dt = new Date(d);
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };

  const getStatus = (date?: string, start?: string, end?: string) => {
    if (!date) return { label: 'Không xác định', color: 'bg-gray-100 text-gray-700' };
    const base = new Date(date);
    const [sh, sm] = String(start || '00:00').split(':').map(Number);
    const [eh, em] = String(end || '00:00').split(':').map(Number);
    const startDt = new Date(base);
    startDt.setHours(sh || 0, sm || 0, 0, 0);
    const endDt = new Date(base);
    endDt.setHours(eh || 0, em || 0, 0, 0);
    const now = new Date();
    if (now < startDt) return { label: 'Sắp diễn ra', color: 'bg-blue-100 text-blue-700' };
    if (now >= startDt && now <= endDt) return { label: 'Đang diễn ra', color: 'bg-green-100 text-green-700' };
    return { label: 'Đã kết thúc', color: 'bg-gray-100 text-gray-700' };
  };

  // Phân nhóm lịch thi: Hôm nay, Sắp diễn ra, Đã diễn ra
  const makeGroups = (list: StudentExamSchedule[]) => {
    const normalize = (d?: string) => {
      if (!d) return null;
      const x = new Date(d);
      return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    };
    const n = new Date();
    const today = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    const byDate = (a: StudentExamSchedule, b: StudentExamSchedule) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      if (ad !== bd) return ad - bd;
      return String(a.startTime || '').localeCompare(String(b.startTime || ''));
    };
    const todayList: StudentExamSchedule[] = [];
    const upcomingList: StudentExamSchedule[] = [];
    const pastList: StudentExamSchedule[] = [];
    list.forEach(s => {
      const d = normalize(s.date);
      if (d == null) return;
      if (d === today) todayList.push(s);
      else if (d > today) upcomingList.push(s);
      else pastList.push(s);
    });
    return { today: todayList.sort(byDate), upcoming: upcomingList.sort(byDate), past: pastList.sort(byDate) };
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Lịch thi đã công bố</h1>
        <p className="text-sm text-muted-foreground">Chỉ hiển thị kỳ thi trong vòng 15 ngày gần đây</p>
      </div>

      {/* Mobile-first exam card list */}
      <div className="space-y-4 sm:hidden">
        {exams.map((ex) => {
          const list = schedulesMap[ex._id] || [];
          const doneCount = list.filter(s => {
            const base = new Date(s.date);
            const [eh, em] = String(s.endTime || '00:00').split(':').map(Number);
            const end = new Date(base);
            end.setHours(eh || 0, em || 0, 0, 0);
            return new Date() > end;
          }).length;
          const total = list.length;
          const progress = total ? Math.round((doneCount / total) * 100) : 0;
          const status = (() => {
            const now = new Date();
            const start = ex.startDate ? new Date(ex.startDate) : undefined;
            const end = ex.endDate ? new Date(ex.endDate) : undefined;
            if (start && now < start) return { label: 'Sắp diễn ra', color: 'bg-orange-100 text-orange-700' };
            if (start && end && now >= start && now <= end) return { label: 'Đang diễn ra', color: 'bg-orange-100 text-orange-700' };
            if (end && now > end) return { label: 'Hoàn thành', color: 'bg-green-100 text-green-700' };
            return { label: 'Đã công bố', color: 'bg-sky-100 text-sky-700' };
          })();
          const type = (ex as any).type as string | undefined;
          const typeLabel = type === 'midterm' ? 'Giữa kỳ' : type === 'final' ? 'Cuối kỳ' : 'Kỳ thi';

          return (
            <div key={ex._id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <span className="px-2 py-1 rounded bg-violet-100 text-violet-700">{typeLabel}</span>
                    <span className={`px-2 py-1 rounded ${status.color}`}>{status.label}</span>
                  </div>
                  <div className="text-base font-semibold">{ex.name}</div>
                  <div className="text-sm text-muted-foreground">{ex.year} - HK{ex.semester}</div>
                  <div className="mt-3 flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(ex.startDate)} - {formatDate(ex.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4 text-violet-600" />
                      <span>{total} môn</span>
                    </div>
                  </div>
                  {total > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Tiến độ</span>
                        <span>{doneCount}/{total}</span>
                      </div>
                      <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
                        <div className="h-2 bg-violet-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <button
                  className="p-2 text-muted-foreground hover:text-foreground transition"
                  onClick={async () => {
                    setExpanded(prev => ({ ...prev, [ex._id]: !prev[ex._id] }));
                    if (!expanded[ex._id]) await ensureRoomsForExam(ex._id);
                  }}
                  aria-label="Expand"
                >
                  <ChevronDown className={`h-5 w-5 ${expanded[ex._id] ? 'rotate-180' : ''} transition-transform`} />
                </button>
              </div>

              {expanded[ex._id] && (
                <div className="mt-4 sm:hidden">
                  {(() => {
                    const groups = makeGroups(list);
                    const roomInfo = roomsMap[ex._id] || {};
                    const Section = ({ title, arr }: { title: string; arr: StudentExamSchedule[] }) => (
                      arr.length > 0 ? (
                        <div className="mb-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold">{title}</div>
                            <div className="text-xs text-muted-foreground">{arr.length}</div>
                          </div>
                          {arr.map((s, idx) => (
                            <div key={`${title}-${idx}`} className="rounded-xl border p-4 bg-white shadow-sm flex flex-col gap-3 mb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="text-base font-semibold">{s.subject?.name || 'Môn chưa rõ'}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">{formatDate(s.date)}</span>
                                    <span className="text-xs px-2 py-1 rounded bg-sky-100 text-sky-700">{s.startTime} - {s.endTime}</span>
                                    <span className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700">{getDuration(s.startTime, s.endTime)}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${getStatus(s.date, s.startTime, s.endTime).color}`}>{getStatus(s.date, s.startTime, s.endTime).label}</span>
                                    {isToday(s.date) && (<span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">Hôm nay</span>)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] text-muted-foreground">Phòng</div>
                                  <div className="text-sm font-medium">{(roomInfo[s._id] as any)?.room || (roomInfo[s._id] as any)?.roomCode || s.room?.roomCode || s.fixedRoomCode || '-'}</div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t">
                                <div className="text-[11px] text-muted-foreground">Số thứ tự</div>
                                <div className="text-sm font-medium">{roomInfo[s._id]?.seatNumber || s.seatNumber || '-'}</div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] text-muted-foreground">Số báo danh</div>
                                <div className="text-sm font-medium">{
                                  ((s as any).sbd
                                    ?? (s as any)?.examStudent?.sbd
                                    ?? (s as any)?.studentExam?.sbd
                                    ?? (s as any)?.student?.sbd
                                    ?? (roomsMap[ex._id]?.[s._id] as any)?.sbd
                                  ) || '-'
                                }</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null
                    );
                    return (
                      <div>
                        <Section title="Hôm nay" arr={groups.today} />
                        <Section title="Sắp diễn ra" arr={groups.upcoming} />
                        <Section title="Đã diễn ra" arr={groups.past} />
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}

        {exams.length === 0 && (
          <div className="rounded-lg border p-6 text-center text-sm text-gray-500">Chưa có kỳ thi phù hợp</div>
        )}
      </div>

      {/* Desktop: keep legacy table UI for clarity */}
      <div className="hidden sm:block">
        <StudentScheduleLegacy />
      </div>
    </div>
  );
}

























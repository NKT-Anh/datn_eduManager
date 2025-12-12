import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import React from 'react';
import api from '@/services/axiosInstance';
import { 
  Users, 
  School, 
  Calendar, 
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { examApi } from '@/services/exams/examApi';
import { NavLink } from 'react-router-dom';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import { useAssignments } from '@/hooks/assignments/useAssignments';
import { scheduleApi } from '@/services/scheduleApi';

// Types inferred from existing API usage (best-effort)
interface ScheduleClassRef {
  _id?: string;
  id?: string;
  name?: string;
  className?: string;
  grade?: string;
}

interface ScheduleSubjectRef {
  name?: string;
}

interface GvbmScheduleItem {
  date?: string;
  day?: string;
  weekday?: string;
  period?: number;
  class?: ScheduleClassRef;
  classId?: string;
  subject?: string | ScheduleSubjectRef;
}

interface UpcomingExamItem {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  className?: string;
  class?: { name?: string };
  date?: string;
  examDate?: string;
  scheduledDate?: string;
}

interface NotificationItem {
  _id?: string;
  id?: string;
  title?: string;
  subject?: string;
  message?: string;
  content?: string;
}

const TeacherDashboard = () => {
  const { backendUser } = useAuth();
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { currentYearCode } = useCurrentAcademicYear();
  const teacherId = typeof backendUser?.teacherId === 'object' && backendUser?.teacherId !== null
    ? (backendUser.teacherId as any)._id
    : backendUser?.teacherId || backendUser?._id;
  // default semester: 1 (could be derived from config if needed)
  const semester = '1';
  const { assignments } = useAssignments(teacherId || '');
  const [schedules, setSchedules] = React.useState<any[]>([]);
  
  // Lịch dạy hôm nay và tuần
  const [todaySchedule, setTodaySchedule] = React.useState<GvbmScheduleItem[]>([]);
  const [weeklySchedule, setWeeklySchedule] = React.useState<GvbmScheduleItem[]>([]);
  // Kỳ kiểm tra sắp diễn ra
  const [upcomingExams, setUpcomingExams] = React.useState<UpcomingExamItem[]>([]);
  // Thông báo mới
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);

  // Tính lớp đang dạy từ lịch
  const teacherClasses = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const item of todaySchedule) {
      const id = item.class?._id || item.classId;
      if (!id) continue;
      if (!map.has(id)) map.set(id, item.class || { _id: id, name: 'Lớp' });
    }
    return Array.from(map.values());
  }, [todaySchedule]);
  const subjectSet = React.useMemo(() => {
    // Prefer subjects from assignments; fallback to today's schedule
    const s = new Set<string>();
    (assignments || []).forEach(a => {
      const name = (a as any)?.subjectId?.name;
      if (name) s.add(name);
    });
    if (s.size === 0) {
      todaySchedule.forEach(it => {
        if (typeof it.subject === 'string') s.add(it.subject);
        else if (it.subject?.name) s.add(it.subject.name);
      });
    }
    return s;
  }, [assignments, todaySchedule]);
  const totalStudents = undefined; // Cần API roster lớp để tính chính xác
  // Nhóm lịch tuần theo ngày (giống cách hiển thị weekly)
  const weeklyByDay = React.useMemo(() => {
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const buckets: Record<string, any[]> = {};
    daysOrder.forEach(d => { buckets[d] = []; });
    (weeklySchedule || []).forEach((it: any) => {
      const d = (it.weekday || it.day || '').toString();
      const key = daysOrder.find(k => d.toLowerCase().startsWith(k.toLowerCase().slice(0,3))) || d || 'Monday';
      buckets[key] = buckets[key] || [];
      buckets[key].push(it);
    });
    // sort by period
    Object.keys(buckets).forEach(k => {
      buckets[k].sort((a, b) => (a.period ?? 0) - (b.period ?? 0));
    });
    return { order: daysOrder, buckets };
  }, [weeklySchedule]);
  
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      // Derive today's and weekly schedule from teacher schedules (avoid direct axios in page)

      // Invigilation schedule using examApi service
      try {
        const data = await examApi.getSupervisorSchedule({ limit: 10 });
        const upcoming = Array.isArray(data) ? data.filter((e: any) => {
          const dateStr = e.examDate || e.date || e.scheduledDate;
          const dt = dateStr ? new Date(dateStr) : null;
          return dt && dt.getTime() >= Date.now();
        }).slice(0, 5) : [];
        if (mounted) setUpcomingExams(upcoming);
      } catch (e) {
        setUpcomingExams([]);
      }

      // Notifications (generic teacher notifications if available)
      try {
        const notiRes = await api.get('/notifications', { params: { scope: 'teacher', limit: 5 } });
        const items = notiRes?.data?.data || notiRes?.data || [];
        if (mounted) setNotifications(Array.isArray(items) ? items.slice(0, 5) : []);
      } catch (e) {
        setNotifications([]);
      }
      // Fetch classes teaching (same as TeacherSchedulePage)
      try {
        if (teacherId && currentYearCode) {
          const data = await scheduleApi.getScheduleByTeacher(teacherId, currentYearCode, semester);
          const parsed = Array.isArray(data) ? data : [];
          if (mounted) setSchedules(parsed);
          // Build weekly/today items from schedules
          const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const weeklyItems: GvbmScheduleItem[] = [];
          parsed.forEach((sch: any) => {
            (sch.timetable || []).forEach((dayEntry: any) => {
              const dayKey = DAY_LABELS.find(d => d.toLowerCase().includes((dayEntry.day || '').toLowerCase().slice(0,3))) || dayEntry.day;
              (dayEntry.periods || []).forEach((p: any) => {
                // ✅ Lấy tên lớp từ classId (đã được populate) hoặc className
                const classObj = sch.classId;
                const className = classObj?.className || sch.className || 'Lớp';
                weeklyItems.push({
                  weekday: dayKey,
                  period: p.period || p.periodIndex,
                  class: classObj ? { ...classObj, name: className } : { name: className },
                  subject: p.subject || p.subjectName,
                });
              });
            });
          });
          if (mounted) setWeeklySchedule(weeklyItems);

          // Today's items based on current weekday
          const todayIdx = new Date().getDay(); // 0=Sun..6=Sat
          const weekdayMap = [null,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const todayLabel = weekdayMap[todayIdx] || 'Monday';
          const todayItems = weeklyItems.filter(it => (it.weekday || '') === todayLabel);
          if (mounted) setTodaySchedule(todayItems);
        } else {
          if (mounted) setSchedules([]);
          if (mounted) setWeeklySchedule([]);
          if (mounted) setTodaySchedule([]);
        }
      } catch (err) {
        if (mounted) setSchedules([]);
        if (mounted) setWeeklySchedule([]);
        if (mounted) setTodaySchedule([]);
      }
    })();
    return () => { mounted = false; };
  }, [backendUser?._id]);

  // TODO: Có thể bổ sung API lấy roster để hiển thị tổng học sinh chính xác

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Giáo viên</h1>
        <p className="text-muted-foreground">Xin chào, {backendUser?.name}!</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Các lớp giảng dạy</p>
                <p className="text-3xl font-bold text-foreground">{schedules.length}</p>
              </div>
              <School className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Số môn đang phụ trách</p>
                <p className="text-3xl font-bold text-foreground">{subjectSet.size}</p>
                <p className="text-xs text-muted-foreground mt-1">Từ lịch hôm nay</p>
              </div>
              <BookOpen className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bài kiểm tra trong tuần</p>
                <p className="text-3xl font-bold text-foreground">{upcomingExams.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tỉ lệ nhập điểm</p>
                <p className="text-3xl font-bold text-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">Đang cập nhật</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

      {/* Current-year Teaching Classes */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Các lớp giảng dạy
          </CardTitle>
          <CardDescription>Danh sách lớp theo năm học hiện tại</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedules.length > 0 ? (
            schedules.map((schedule: any) => (
              <div key={schedule?._id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{schedule?.classId?.className || schedule?.className || 'Lớp'}</p>
                  <p className="text-sm text-muted-foreground">
                    {schedule?.classId?.grade ? `Khối ${schedule.classId.grade}` : ''}
                  </p>
                </div>
                <Badge variant="outline">Đang dạy</Badge>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Chưa có lớp nào trong năm hiện tại</p>
          )}
          <div className="mt-4">
            <NavLink to="/gvbm/schedule" className="text-sm text-primary hover:underline">
              Xem lịch giảng dạy →
            </NavLink>
          </div>
        </CardContent>
      </Card>

        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <School className="h-5 w-5 mr-2" />
              Lớp đang dạy
            </CardTitle>
            <CardDescription>Danh sách lớp theo lịch hôm nay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {teacherClasses.length > 0 ? (
              teacherClasses.map((cls: any) => {
                return (
                  <div key={cls?._id || cls?.id || cls?.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-12 h-12 bg-success/10 rounded-lg">
                        <School className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium">{cls?.name || 'Lớp'}</p>
                        <p className="text-sm text-muted-foreground">
                          {cls?.grade ? `Khối ${cls.grade}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">❗ Chưa nhập</Badge>
                      <NavLink to="/gvbm/my-classes" className="text-primary text-sm flex items-center">
                        Vào lớp <ChevronRight className="h-4 w-4 ml-1" />
                      </NavLink>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <School className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Chưa có lớp dạy trong hôm nay</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  
      {/* Weekly Teaching Schedule */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Lịch dạy trong tuần
          </CardTitle>
          <CardDescription>Những tiết dạy theo từng ngày</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {weeklySchedule.length === 0 ? (
            <p className="text-muted-foreground">Chưa có dữ liệu lịch dạy trong tuần</p>
          ) : (
            weeklyByDay.order.map(day => (
              weeklyByDay.buckets[day].length > 0 && (
                <div key={day}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{day}</p>
                  <div className="space-y-2">
                    {weeklyByDay.buckets[day].slice(0, 6).map((it, idx) => (
                      <div key={`${day}-${it.class?._id}-${it.period}-${idx}`} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              Tiết {it.period ?? '?'} • {it.class?.name || it.class?.className || 'Lớp'} • {typeof it.subject === 'string' ? it.subject : (it.subject?.name || 'Môn')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))
          )}
          <div className="mt-4">
            <NavLink to="/gvbm/schedule-weekly" className="text-sm text-primary hover:underline">
              Xem đầy đủ lịch dạy tuần →
            </NavLink>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Exams */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Kỳ kiểm tra sắp diễn ra
          </CardTitle>
          <CardDescription>Từ module Exam</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingExams.length > 0 ? (
            upcomingExams.map((ex: any) => (
              <div key={ex._id || ex.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{ex.name || ex.title || 'Kỳ kiểm tra'}</p>
                  <p className="text-sm text-muted-foreground">
                    {ex.className || ex.class?.name || 'Lớp'} • {ex.date || ex.examDate}
                  </p>
                </div>
                <Badge variant="outline">Chờ</Badge>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Không có kỳ kiểm tra sắp tới</p>
          )}
          <div className="mt-4">
            <NavLink to="/gvbm/exams" className="text-sm text-primary hover:underline">
              Xem tất cả kỳ thi →
            </NavLink>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Thông báo mới
          </CardTitle>
          <CardDescription>Liên quan đến giáo viên bộ môn</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length > 0 ? (
            notifications.map((n: any) => (
              <div key={n._id || n.id} className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{n.title || n.subject || 'Thông báo'}</p>
                <p className="text-sm text-muted-foreground">{n.message || n.content || ''}</p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Chưa có thông báo mới</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle>Thao tác nhanh</CardTitle>
          <CardDescription>Các chức năng thường dùng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <BookOpen className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Nhập điểm</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <Users className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm font-medium">Điểm danh</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <Calendar className="h-8 w-8 text-warning mx-auto mb-2" />
              <p className="text-sm font-medium">Xem lịch</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/70 cursor-pointer transition-colors">
              <School className="h-8 w-8 text-accent mx-auto mb-2" />
              <p className="text-sm font-medium">Quản lý lớp</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherDashboard;
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  RotateCcw,
  Clock,
  User,
  BookOpen
} from 'lucide-react';
import { scheduleApi } from '@/services/scheduleApi';
import { subjectApi } from '@/services/subjectApi';
import { activityApi } from '@/services/activityApi';
import { assignmentApi } from '@/services/assignmentApi';
import { ClassSchedule, TimetableEntry, PeriodEntry } from '@/types/schedule';
import { Subject, Activity, TeachingAssignment, ActivityInput } from '@/types/class';

interface DragDropScheduleProps {
  schedule: ClassSchedule | null;
  scheduleConfig: any;
  onScheduleUpdate: (schedule: ClassSchedule) => void;
  onSave: (schedule: ClassSchedule) => Promise<void>;
}

interface SubjectFormData {
  name: string;
  periodsPerWeek: number;
  maxPeriodsPerDay: number;
  allowConsecutive: boolean;
  session: 'main' | 'extra';
  type: 'subject' | 'activity';
}

interface ActivityFormData {
  name: string;
  periodsPerWeek: number;
  maxPeriodsPerDay: number;
  allowConsecutive: boolean;
  session: 'main' | 'extra';
  type: 'activity';
  dayOfWeek?: string;
  timeSlot?: string;
}

const DragDropSchedule: React.FC<DragDropScheduleProps> = ({
  schedule,
  scheduleConfig,
  onScheduleUpdate,
  onSave
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [subjectForm, setSubjectForm] = useState<SubjectFormData>({
    name: '',
    periodsPerWeek: 1,
    maxPeriodsPerDay: 1,
    allowConsecutive: true,
    session: 'main',
    type: 'subject'
  });
  const [activityForm, setActivityForm] = useState<ActivityFormData>({
    name: '',
    periodsPerWeek: 1,
    maxPeriodsPerDay: 1,
    allowConsecutive: false,
    session: 'main',
    type: 'activity'
  });
  const [editingPeriod, setEditingPeriod] = useState<{
    day: string;
    period: number;
  } | null>(null);

  const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subjectsRes, activitiesRes, assignmentsRes] = await Promise.all([
        subjectApi.getSubjects(),
        activityApi.getActivities(),
        assignmentApi.getAll()
      ]);
      setSubjects(subjectsRes);
      setActivities(activitiesRes);
      setAssignments(assignmentsRes);
    } catch (error) {
      console.error('Lỗi tải dữ liệu:', error);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination || !schedule) return;

    const { source, destination } = result;
    const sourceDay = source.droppableId;
    const destDay = destination.droppableId;
    const sourcePeriod = source.index;
    const destPeriod = destination.index;

    // Tạo bản sao của schedule
    const updatedSchedule = { ...schedule };
    const updatedTimetable = [...updatedSchedule.timetable];

    // Tìm day entries
    const sourceDayEntry = updatedTimetable.find(t => t.day === sourceDay);
    const destDayEntry = updatedTimetable.find(t => t.day === destDay);

    if (!sourceDayEntry || !destDayEntry) return;

    // Lấy dữ liệu tiết
    const sourcePeriodData = sourceDayEntry.periods[sourcePeriod];
    const destPeriodData = destDayEntry.periods[destPeriod];

    // Hoán đổi
    const tempSubject = sourcePeriodData.subject;
    const tempTeacher = sourcePeriodData.teacher;

    sourcePeriodData.subject = destPeriodData.subject;
    sourcePeriodData.teacher = destPeriodData.teacher;
    destPeriodData.subject = tempSubject;
    destPeriodData.teacher = tempTeacher;

    // Cập nhật state
    updatedSchedule.timetable = updatedTimetable;
    onScheduleUpdate(updatedSchedule);
  };

  const handleAddSubject = async () => {
    if (!subjectForm.name.trim()) return;

    try {
      // Thêm môn học vào cấu hình
      const response = await fetch('/api/scheduleConfig/subject-hours', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subjectHours: {
            [subjectForm.name]: {
              periodsPerWeek: subjectForm.periodsPerWeek,
              maxPeriodsPerDay: subjectForm.maxPeriodsPerDay,
              allowConsecutive: subjectForm.allowConsecutive,
              session: subjectForm.session
            }
          }
        })
      });

      if (response.ok) {
        // Reset form
        setSubjectForm({
          name: '',
          periodsPerWeek: 1,
          maxPeriodsPerDay: 1,
          allowConsecutive: true,
          session: 'main',
          type: 'subject'
        });
        setIsAddingSubject(false);
        // Refresh data
        window.location.reload();
      }
    } catch (error) {
      console.error('Lỗi thêm môn học:', error);
    }
  };

  const handleAddActivity = async () => {
    if (!activityForm.name.trim()) return;

    try {
      // Tạo hoạt động mới
      const activityData = {
        name: activityForm.name,
        type: 'weekly' as 'weekly' | 'special',
        grades: ['10', '11', '12'] as string[], // Áp dụng cho tất cả khối
        dayOfWeek: activityForm.dayOfWeek as 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday',
        timeSlot: activityForm.timeSlot,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().getFullYear() + 1, 5, 30).toISOString().split('T')[0], // 1 năm sau
        isActive: true
      };

      const response = await activityApi.createActivity(activityData);

      if (response) {
        // Reset form
        setActivityForm({
          name: '',
          periodsPerWeek: 1,
          maxPeriodsPerDay: 1,
          allowConsecutive: false,
          session: 'main',
          type: 'activity'
        });
        setIsAddingActivity(false);
        // Refresh data
        fetchData();
      }
    } catch (error) {
      console.error('Lỗi thêm hoạt động:', error);
    }
  };

  const handleEditPeriod = (day: string, period: number) => {
    setEditingPeriod({ day, period });
  };

  const handleSavePeriod = (subject: string, teacher: string) => {
    if (!schedule || !editingPeriod) return;

    const updatedSchedule = { ...schedule };
    const dayEntry = updatedSchedule.timetable.find(t => t.day === editingPeriod.day);
    
    if (dayEntry) {
      dayEntry.periods[editingPeriod.period - 1] = {
        period: editingPeriod.period,
        subject,
        teacher
      };
      onScheduleUpdate(updatedSchedule);
    }
    
    setEditingPeriod(null);
  };

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    await onSave(schedule);
  };

  const handleResetSchedule = () => {
    if (schedule) {
      // Reset tất cả tiết về trống
      const updatedSchedule = { ...schedule };
      updatedSchedule.timetable.forEach(dayEntry => {
        dayEntry.periods.forEach(period => {
          period.subject = '';
          period.teacher = '';
        });
      });
      onScheduleUpdate(updatedSchedule);
    }
  };

  const getAvailableTeachers = (subjectName: string) => {
    return assignments
      .filter(a => a.subjectId?.name === subjectName)
      .map(a => a.teacherId?.name || '')
      .filter(Boolean);
  };

  const getAllItems = () => {
    const allItems = [];
    
    // Thêm môn học
    subjects.forEach(subject => {
      allItems.push({
        id: subject._id,
        name: subject.name,
        type: 'subject'
      });
    });
    
    // Thêm hoạt động
    activities.forEach(activity => {
      allItems.push({
        id: activity._id,
        name: activity.name,
        type: 'activity'
      });
    });
    
    return allItems;
  };

  const getPeriodTime = (periodIdx: number, session: 'morning' | 'afternoon') => {
    if (!scheduleConfig) return '';

    const startBase = session === 'morning' 
      ? scheduleConfig.defaultStartTimeMorning 
      : scheduleConfig.defaultStartTimeAfternoon;

    const [hour, minute] = startBase.split(':').map(Number);
    let totalMinutes = hour * 60 + minute;

    for (let i = 0; i < periodIdx; i++) {
      totalMinutes += scheduleConfig.minutesPerPeriod;
      const specialBreak = scheduleConfig.specialBreaks?.find(
        (b: any) => b.period === i + 1 && b.session === session
      );
      totalMinutes += specialBreak ? specialBreak.minutes : scheduleConfig.defaultBreakMinutes;
    }

    const startHour = Math.floor(totalMinutes / 60);
    const startMinute = totalMinutes % 60;
    const endMinutes = totalMinutes + scheduleConfig.minutesPerPeriod;
    const endHour = Math.floor(endMinutes / 60);
    const endMinute = endMinutes % 60;

    return `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  };

  if (!schedule) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Chọn lớp để xem thời khóa biểu</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header với các nút điều khiển */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Thời khóa biểu lớp {schedule.className}
            </CardTitle>
            <div className="flex gap-2">
              <Dialog open={isAddingSubject} onOpenChange={setIsAddingSubject}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm môn học
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Thêm môn học mới</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="subjectName">Tên môn học</Label>
                      <Input
                        id="subjectName"
                        value={subjectForm.name}
                        onChange={(e) => setSubjectForm({...subjectForm, name: e.target.value})}
                        placeholder="Nhập tên môn học"
                      />
                    </div>
                    <div>
                      <Label htmlFor="periodsPerWeek">Số tiết/tuần</Label>
                      <Input
                        id="periodsPerWeek"
                        type="number"
                        min="1"
                        max="10"
                        value={subjectForm.periodsPerWeek}
                        onChange={(e) => setSubjectForm({...subjectForm, periodsPerWeek: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxPeriodsPerDay">Tối đa tiết/ngày</Label>
                      <Input
                        id="maxPeriodsPerDay"
                        type="number"
                        min="1"
                        max="5"
                        value={subjectForm.maxPeriodsPerDay}
                        onChange={(e) => setSubjectForm({...subjectForm, maxPeriodsPerDay: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="session">Buổi học</Label>
                      <Select
                        value={subjectForm.session}
                        onValueChange={(value: 'main' | 'extra') => setSubjectForm({...subjectForm, session: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">Buổi chính</SelectItem>
                          <SelectItem value="extra">Buổi phụ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="allowConsecutive"
                        checked={subjectForm.allowConsecutive}
                        onChange={(e) => setSubjectForm({...subjectForm, allowConsecutive: e.target.checked})}
                      />
                      <Label htmlFor="allowConsecutive">Cho phép tiết liên tiếp</Label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAddingSubject(false)}>
                        Hủy
                      </Button>
                      <Button onClick={handleAddSubject}>
                        Thêm môn học
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddingActivity} onOpenChange={setIsAddingActivity}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm hoạt động
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Thêm hoạt động mới</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="activityName">Tên hoạt động</Label>
                      <Input
                        id="activityName"
                        value={activityForm.name}
                        onChange={(e) => setActivityForm({...activityForm, name: e.target.value})}
                        placeholder="Nhập tên hoạt động"
                      />
                    </div>
                    <div>
                      <Label htmlFor="activityDayOfWeek">Ngày trong tuần</Label>
                      <Select
                        value={activityForm.dayOfWeek || ''}
                        onValueChange={(value) => setActivityForm({...activityForm, dayOfWeek: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn ngày" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monday">Thứ 2</SelectItem>
                          <SelectItem value="Tuesday">Thứ 3</SelectItem>
                          <SelectItem value="Wednesday">Thứ 4</SelectItem>
                          <SelectItem value="Thursday">Thứ 5</SelectItem>
                          <SelectItem value="Friday">Thứ 6</SelectItem>
                          <SelectItem value="Saturday">Thứ 7</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="activityTimeSlot">Tiết học</Label>
                      <Input
                        id="activityTimeSlot"
                        value={activityForm.timeSlot || ''}
                        onChange={(e) => setActivityForm({...activityForm, timeSlot: e.target.value})}
                        placeholder="VD: Tiết 1, 07:00-07:45"
                      />
                    </div>
                    <div>
                      <Label htmlFor="activitySession">Buổi học</Label>
                      <Select
                        value={activityForm.session}
                        onValueChange={(value: 'main' | 'extra') => setActivityForm({...activityForm, session: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">Buổi chính</SelectItem>
                          <SelectItem value="extra">Buổi phụ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAddingActivity(false)}>
                        Hủy
                      </Button>
                      <Button onClick={handleAddActivity}>
                        Thêm hoạt động
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" size="sm" onClick={handleResetSchedule}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              
              <Button size="sm" onClick={handleSaveSchedule}>
                <Save className="h-4 w-4 mr-2" />
                Lưu
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Bảng thời khóa biểu với kéo thả */}
      <Card>
        <CardContent className="p-0">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Tiết (Giờ)</TableHead>
                  {dayNames.map(day => (
                    <TableHead key={day} className="text-center">{day}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Buổi sáng */}
                <TableRow>
                  <TableCell colSpan={dayNames.length + 1} className="font-bold text-center bg-blue-50">
                    🌅 Buổi sáng
                  </TableCell>
                </TableRow>
                
                {Array.from({ length: scheduleConfig?.days?.mon?.morningPeriods || 5 }, (_, idx) => {
                  const timeLabel = getPeriodTime(idx, 'morning');
                  return (
                    <TableRow key={`morning-${idx}`}>
                      <TableCell className="font-medium">
                        {idx + 1} ({timeLabel})
                      </TableCell>
                      {dayNames.map(day => {
                        const dayEntry = schedule.timetable.find(t => t.day === day);
                        const period = dayEntry?.periods[idx];
                        
                        return (
                          <TableCell key={`${day}-morning-${idx}`} className="p-1">
                            <Droppable droppableId={day} index={idx}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`min-h-[60px] border-2 border-dashed rounded-lg p-2 ${
                                    snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                                  }`}
                                >
                                  {period?.subject ? (
                                    <Draggable
                                      draggableId={`${day}-${idx}-${period.subject}`}
                                      index={idx}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`p-2 rounded border ${
                                            period.teacher === 'Hoạt động' 
                                              ? 'bg-orange-100 border-orange-300' 
                                              : 'bg-white border-gray-200'
                                          } ${
                                            snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                                          } ${
                                            period.teacher === 'Hoạt động' 
                                              ? 'cursor-default' 
                                              : 'cursor-move'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                              <Badge 
                                                variant={period.teacher === 'Hoạt động' ? 'destructive' : 'secondary'} 
                                                className="mb-1"
                                              >
                                                {period.subject}
                                                {period.teacher === 'Hoạt động' && ' (Cố định)'}
                                              </Badge>
                                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {period.teacher}
                                              </div>
                                            </div>
                                            {period.teacher !== 'Hoạt động' && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEditPeriod(day, idx + 1)}
                                                className="h-6 w-6 p-0"
                                              >
                                                <Edit className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ) : (
                                    <div className="text-gray-400 text-sm text-center py-2">
                                      Kéo môn học vào đây
                                    </div>
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}

                {/* Buổi chiều */}
                <TableRow>
                  <TableCell colSpan={dayNames.length + 1} className="font-bold text-center bg-orange-50">
                    🌇 Buổi chiều
                  </TableCell>
                </TableRow>
                
                {Array.from({ length: scheduleConfig?.days?.mon?.afternoonPeriods || 3 }, (_, idx) => {
                  const timeLabel = getPeriodTime(idx, 'afternoon');
                  const periodIdx = idx + (scheduleConfig?.days?.mon?.morningPeriods || 5);
                  
                  return (
                    <TableRow key={`afternoon-${idx}`}>
                      <TableCell className="font-medium">
                        {periodIdx + 1} ({timeLabel})
                      </TableCell>
                      {dayNames.map(day => {
                        const dayEntry = schedule.timetable.find(t => t.day === day);
                        const period = dayEntry?.periods[periodIdx];
                        
                        return (
                          <TableCell key={`${day}-afternoon-${idx}`} className="p-1">
                            <Droppable droppableId={day} index={periodIdx}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`min-h-[60px] border-2 border-dashed rounded-lg p-2 ${
                                    snapshot.isDraggingOver ? 'border-orange-400 bg-orange-50' : 'border-gray-200'
                                  }`}
                                >
                                  {period?.subject ? (
                                    <Draggable
                                      draggableId={`${day}-${periodIdx}-${period.subject}`}
                                      index={periodIdx}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`p-2 rounded border ${
                                            period.teacher === 'Hoạt động' 
                                              ? 'bg-orange-100 border-orange-300' 
                                              : 'bg-white border-gray-200'
                                          } ${
                                            snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                                          } ${
                                            period.teacher === 'Hoạt động' 
                                              ? 'cursor-default' 
                                              : 'cursor-move'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                              <Badge 
                                                variant={period.teacher === 'Hoạt động' ? 'destructive' : 'secondary'} 
                                                className="mb-1"
                                              >
                                                {period.subject}
                                                {period.teacher === 'Hoạt động' && ' (Cố định)'}
                                              </Badge>
                                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {period.teacher}
                                              </div>
                                            </div>
                                            {period.teacher !== 'Hoạt động' && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEditPeriod(day, periodIdx + 1)}
                                                className="h-6 w-6 p-0"
                                              >
                                                <Edit className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ) : (
                                    <div className="text-gray-400 text-sm text-center py-2">
                                      Kéo môn học vào đây
                                    </div>
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Dialog chỉnh sửa tiết học */}
      {editingPeriod && (
        <Dialog open={!!editingPeriod} onOpenChange={() => setEditingPeriod(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chỉnh sửa tiết học</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="item">Môn học / Hoạt động</Label>
                <Select onValueChange={(value) => {
                  const item = getAllItems().find(i => i.name === value);
                  if (item) {
                    if (item.type === 'subject') {
                      const teachers = getAvailableTeachers(value);
                      // Auto-select first teacher if available
                      if (teachers.length > 0) {
                        handleSavePeriod(value, teachers[0]);
                      } else {
                        handleSavePeriod(value, 'Chưa phân công');
                      }
                    } else {
                      // Hoạt động không cần giáo viên
                      handleSavePeriod(value, 'Hoạt động');
                    }
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn môn học hoặc hoạt động" />
                  </SelectTrigger>
                  <SelectContent>
                    <optgroup label="Môn học">
                      {subjects.map(subject => (
                        <SelectItem key={subject._id} value={subject.name}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </optgroup>
                    <optgroup label="Hoạt động">
                      {activities.map(activity => (
                        <SelectItem key={activity._id} value={activity.name}>
                          {activity.name}
                        </SelectItem>
                      ))}
                    </optgroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default DragDropSchedule;

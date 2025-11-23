import React, { useState, useEffect } from 'react';
import { Subject, Teacher, Period, TimetableConfig } from '@/types/timetable';
import { TimetableGrid } from './TimetableGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Plus, 
  Save, 
  RotateCcw,
  BookOpen,
  User,
  GripVertical,
  X,
  Edit
} from 'lucide-react';
import { scheduleApi } from '@/services/scheduleApi';
import { subjectApi } from '@/services/subjectApi';
import { activityApi } from '@/services/activityApi';
import { assignmentApi } from '@/services/assignmentApi';
import { ClassSchedule } from '@/types/schedule';
import { Subject as SubjectType, Activity, TeachingAssignment } from '@/types/class';

interface ModernTimetableProps {
  schedule: ClassSchedule | null;
  scheduleConfig: any;
  onScheduleUpdate: (schedule: ClassSchedule) => void;
  onSave: (schedule: ClassSchedule) => Promise<void>;
  onGenerateSchedule?: (grades: string[], year: string, semester: string) => Promise<void>;
  classes?: any[];
  selectedYear?: string;
  selectedSemester?: string;
}

interface DraggableItem {
  id: string;
  type: 'subject' | 'activity';
  name: string;
  teacher: string;
  teacherId?: string;
  color: string;
}

const ModernTimetable: React.FC<ModernTimetableProps> = ({
  schedule,
  scheduleConfig,
  onScheduleUpdate,
  onSave,
  onGenerateSchedule,
  classes = [],
  selectedYear = '',
  selectedSemester = '1'
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [draggableItems, setDraggableItems] = useState<DraggableItem[]>([]);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [editingPeriod, setEditingPeriod] = useState<{
    day: number;
    period: number;
  } | null>(null);

  // Màu sắc cho các môn học
  const subjectColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
    '#14B8A6', '#F43F5E', '#8B5A2B', '#059669', '#DC2626'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (schedule) {
      convertScheduleToPeriods();
    }
  }, [schedule]);

  const fetchData = async () => {
    try {
      const [subjectsRes, activitiesRes, assignmentsRes] = await Promise.all([
        subjectApi.getSubjects(),
        activityApi.getActivities(),
        assignmentApi.getAll()
      ]);

      // Convert subjects
      const subjectsData: Subject[] = subjectsRes.map((subject, index) => ({
        id: subject._id,
        name: subject.name,
        color: subjectColors[index % subjectColors.length],
        code: subject.code
      }));

      // Convert teachers
      const teachersData: Teacher[] = assignmentsRes
        .map(a => a.teacherId)
        .filter(Boolean)
        .map((teacher, index) => ({
          id: teacher._id,
          name: teacher.name,
        //   email: teacher.email,
        //   phone: teacher.phone
        }));

      // Create draggable items
      const items: DraggableItem[] = [];
      
      subjectsRes.forEach((subject, index) => {
        const assignment = assignmentsRes.find(a => a.subjectId?._id === subject._id);
        items.push({
          id: `subject-${subject._id}`,
          type: 'subject',
          name: subject.name,
          teacher: assignment?.teacherId?.name || 'Chưa phân công',
          teacherId: assignment?.teacherId?._id,
          color: subjectColors[index % subjectColors.length]
        });
      });
      
      activitiesRes.forEach((activity, index) => {
        items.push({
          id: `activity-${activity._id}`,
          type: 'activity',
          name: activity.name,
          teacher: 'Hoạt động',
          color: '#F59E0B'
        });
      });

      setSubjects(subjectsData);
      setTeachers(teachersData);
      setDraggableItems(items);
    } catch (error) {
      console.error('Lỗi tải dữ liệu:', error);
    }
  };

  const convertScheduleToPeriods = () => {
    if (!schedule) return;

    const newPeriods: Period[] = [];
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

    schedule.timetable.forEach(dayEntry => {
      const dayIndex = dayNames.indexOf(dayEntry.day);
      if (dayIndex === -1) return;

      dayEntry.periods.forEach(period => {
        if (period.subject) {
          const subject = subjects.find(s => s.name === period.subject);
          const teacher = teachers.find(t => t.name === period.teacher);
          
          newPeriods.push({
            day: dayIndex,
            period: period.period - 1, // Convert to 0-based
            subjectId: subject?.id || null,
            teacherId: teacher?.id || null,
            isFixed: period.teacher === 'Hoạt động'
          });
        }
      });
    });

    setPeriods(newPeriods);
  };

  const handleUpdatePeriods = (newPeriods: Period[]) => {
    setPeriods(newPeriods);
    
    if (!schedule) return;

    // Convert periods back to schedule format
    const updatedSchedule = { ...schedule };
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

    // Clear existing periods
    updatedSchedule.timetable.forEach(dayEntry => {
      dayEntry.periods.forEach(period => {
        period.subject = '';
        period.teacher = '';
      });
    });

    // Fill with new periods
    newPeriods.forEach(period => {
      const dayName = dayNames[period.day];
      const dayEntry = updatedSchedule.timetable.find(t => t.day === dayName);
      
      if (dayEntry && dayEntry.periods[period.period]) {
        const subject = subjects.find(s => s.id === period.subjectId);
        const teacher = teachers.find(t => t.id === period.teacherId);
        
        dayEntry.periods[period.period] = {
          period: period.period + 1, // Convert back to 1-based
          subject: subject?.name || '',
          teacher: teacher?.name || ''
        };
      }
    });

    onScheduleUpdate(updatedSchedule);
  };

  const handleEditPeriod = (day: number, period: number) => {
    setEditingPeriod({ day, period });
  };

  const handleSavePeriod = (subjectName: string, teacherName: string) => {
    if (!editingPeriod) return;

    const newPeriods = [...periods];
    const periodIndex = newPeriods.findIndex(
      p => p.day === editingPeriod.day && p.period === editingPeriod.period
    );

    if (periodIndex !== -1) {
      const subject = subjects.find(s => s.name === subjectName);
      const teacher = teachers.find(t => t.name === teacherName);
      
      newPeriods[periodIndex] = {
        ...newPeriods[periodIndex],
        subjectId: subject?.id || null,
        teacherId: teacher?.id || null
      };
      
      handleUpdatePeriods(newPeriods);
    }
    
    setEditingPeriod(null);
  };

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    await onSave(schedule);
  };

  const handleResetSchedule = () => {
    setPeriods([]);
    if (schedule) {
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

  const config: TimetableConfig = {
    days: {
      mon: {
        totalPeriods: scheduleConfig?.days?.mon?.totalPeriods || 10,
        morningPeriods: scheduleConfig?.days?.mon?.morningPeriods || 5,
        afternoonPeriods: scheduleConfig?.days?.mon?.afternoonPeriods || 5
      }
    },
    defaultStartTimeMorning: scheduleConfig?.defaultStartTimeMorning || '07:00',
    defaultStartTimeAfternoon: scheduleConfig?.defaultStartTimeAfternoon || '12:30',
    minutesPerPeriod: scheduleConfig?.minutesPerPeriod || 45,
    defaultBreakMinutes: scheduleConfig?.defaultBreakMinutes || 5,
    specialBreaks: scheduleConfig?.specialBreaks || []
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
    <div className="flex h-screen">
      {/* Sidebar bên trái */}
      <div className={`w-80 bg-gray-50 border-r transition-all duration-300 ${
        isLeftPanelOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Môn học & Hoạt động</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsLeftPanelOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {draggableItems.map(item => (
              <div
                key={item.id}
                className="p-3 bg-white rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', JSON.stringify(item));
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Badge 
                      variant={item.type === 'activity' ? 'destructive' : 'secondary'} 
                      className="mb-1"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.name}
                    </Badge>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {item.teacher}
                    </div>
                  </div>
                  <GripVertical className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nút mở sidebar */}
      {!isLeftPanelOpen && (
        <Button
          variant="outline"
          size="sm"
          className="fixed left-4 top-4 z-50"
          onClick={() => setIsLeftPanelOpen(true)}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Môn học
        </Button>
      )}

      {/* Nội dung chính */}
      <div className="flex-1 flex flex-col">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Thời khóa biểu lớp {schedule.className}</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsLeftPanelOpen(true)}>
                <BookOpen className="h-4 w-4 mr-2" />
                Môn học
              </Button>
              
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
        </div>

        <div className="flex-1 overflow-auto p-4">
          <TimetableGrid
            periods={periods}
            subjects={subjects}
            teachers={teachers}
            config={config}
            onUpdatePeriods={handleUpdatePeriods}
            onEditPeriod={handleEditPeriod}
            onGenerateSchedule={onGenerateSchedule}
            classes={classes}
            selectedYear={selectedYear}
            selectedSemester={selectedSemester}
          />
        </div>
      </div>

      {/* Dialog chỉnh sửa tiết học */}
      {editingPeriod && (
        <Dialog open={!!editingPeriod} onOpenChange={() => setEditingPeriod(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chỉnh sửa tiết học</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Môn học / Hoạt động</Label>
                <Select onValueChange={(value) => {
                  const item = draggableItems.find(i => i.name === value);
                  if (item) {
                    handleSavePeriod(item.name, item.teacher);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn môn học hoặc hoạt động" />
                  </SelectTrigger>
                  <SelectContent>
                    <optgroup label="Môn học">
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.name}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </optgroup>
                    <optgroup label="Hoạt động">
                      {draggableItems
                        .filter(item => item.type === 'activity')
                        .map(item => (
                          <SelectItem key={item.id} value={item.name}>
                            {item.name}
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

export default ModernTimetable;

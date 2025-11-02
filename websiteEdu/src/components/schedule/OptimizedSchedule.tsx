import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  BookOpen,
  GripVertical,
  X
} from 'lucide-react';
import { scheduleApi } from '@/services/scheduleApi';
import { subjectApi } from '@/services/subjectApi';
import { activityApi } from '@/services/activityApi';
import { assignmentApi } from '@/services/assignmentApi';
import { ClassSchedule, TimetableEntry, PeriodEntry } from '@/types/schedule';
import { Subject, Activity, TeachingAssignment } from '@/types/class';

interface OptimizedScheduleProps {
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
  periodsPerWeek?: number;
  maxPeriodsPerDay?: number;
  allowConsecutive?: boolean;
  session?: 'main' | 'extra';
}

// Component cho item có thể kéo
const DraggableItem = ({ item }: { item: DraggableItem }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 bg-white rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Badge variant={item.type === 'activity' ? 'destructive' : 'secondary'} className="mb-1">
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
  );
};

// Component cho ô thời khóa biểu
const ScheduleCell = ({ 
  day, 
  period, 
  periodData, 
  onEdit, 
  isFixed = false 
}: { 
  day: string; 
  period: number; 
  periodData: PeriodEntry; 
  onEdit: (day: string, period: number) => void;
  isFixed?: boolean;
}) => {
  return (
    <div
      className={`min-h-[80px] border-2 border-dashed rounded-lg p-2 ${
        isFixed 
          ? 'border-orange-300 bg-orange-50' 
          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
      } transition-colors`}
    >
      {periodData.subject ? (
        <div className={`p-2 rounded border ${
          isFixed 
            ? 'bg-orange-100 border-orange-300' 
            : 'bg-white border-gray-200 hover:shadow-md'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Badge 
                variant={isFixed ? 'destructive' : 'secondary'} 
                className="mb-1"
              >
                {periodData.subject}
                {isFixed && ' (Cố định)'}
              </Badge>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <User className="h-3 w-3" />
                {periodData.teacher}
              </div>
            </div>
            {!isFixed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(day, period)}
                className="h-6 w-6 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-gray-400 text-sm text-center py-4">
          Kéo môn học vào đây
        </div>
      )}
    </div>
  );
};

const OptimizedSchedule: React.FC<OptimizedScheduleProps> = ({
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [draggableItems, setDraggableItems] = useState<DraggableItem[]>([]);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<{
    day: string;
    period: number;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  
  // State cho việc chọn khối, năm, học kỳ
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [year, setYear] = useState(selectedYear);
  const [semester, setSemester] = useState(selectedSemester);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      
      // Tạo danh sách items có thể kéo
      const items: DraggableItem[] = [];
      
      // Thêm môn học
      subjectsRes.forEach(subject => {
        const assignment = assignmentsRes.find(a => a.subjectId?._id === subject._id);
        items.push({
          id: `subject-${subject._id}`,
          type: 'subject',
          name: subject.name,
          teacher: assignment?.teacherId?.name || 'Chưa phân công',
          teacherId: assignment?.teacherId?._id,
          periodsPerWeek: 2, // Default
          maxPeriodsPerDay: 2,
          allowConsecutive: true,
          session: 'main'
        });
      });
      
      // Thêm hoạt động
      activitiesRes.forEach(activity => {
        items.push({
          id: `activity-${activity._id}`,
          type: 'activity',
          name: activity.name,
          teacher: 'Hoạt động',
          periodsPerWeek: 1,
          maxPeriodsPerDay: 1,
          allowConsecutive: false,
          session: activity.type === 'weekly' ? 'main' : 'extra'
        });
      });
      
      setDraggableItems(items);
    } catch (error) {
      console.error('Lỗi tải dữ liệu:', error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Xử lý drag over nếu cần
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !schedule) return;

    const activeItem = draggableItems.find(item => item.id === active.id);
    if (!activeItem) return;

    // Parse over.id để lấy thông tin ngày và tiết
    const overId = over.id as string;
    if (overId.startsWith('cell-')) {
      const [, day, period] = overId.split('-');
      const periodNum = parseInt(period);
      
      // Cập nhật thời khóa biểu
      const updatedSchedule = { ...schedule };
      const dayEntry = updatedSchedule.timetable.find(t => t.day === day);
      
      if (dayEntry && dayEntry.periods[periodNum - 1]) {
        dayEntry.periods[periodNum - 1] = {
          period: periodNum,
          subject: activeItem.name,
          teacher: activeItem.teacher
        };
        
        onScheduleUpdate(updatedSchedule);
      }
    }
    
    setActiveId(null);
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

  const handleGenerateSchedule = async () => {
    if (!onGenerateSchedule || selectedGrades.length === 0) return;
    
    setIsGenerating(true);
    try {
      await onGenerateSchedule(selectedGrades, year, semester);
      setShowGenerateDialog(false);
    } catch (error) {
      console.error('Lỗi tạo thời khóa biểu:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGradeToggle = (grade: string) => {
    setSelectedGrades(prev => 
      prev.includes(grade) 
        ? prev.filter(g => g !== grade)
        : [...prev, grade]
    );
  };

  const getAvailableGrades = () => {
    const grades = new Set(classes.map(cls => cls.grade));
    return Array.from(grades).sort();
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
    <div className="flex h-screen">
      {/* Panel bên trái - Danh sách môn học/hoạt động */}
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
          
          <div className="space-y-2">
            <SortableContext items={draggableItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
              {draggableItems.map(item => (
                <DraggableItem key={item.id} item={item} />
              ))}
            </SortableContext>
          </div>
        </div>
      </div>

      {/* Nút mở panel bên trái */}
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Header */}
          <Card className="m-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Thời khóa biểu lớp {schedule.className}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsLeftPanelOpen(true)}>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Môn học
                  </Button>
                  
                  <Button variant="outline" size="sm" onClick={() => setShowGenerateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tạo TKB
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
            </CardHeader>
          </Card>

          {/* Bảng thời khóa biểu */}
          <div className="flex-1 overflow-auto p-4">
            <Card>
              <CardContent className="p-0">
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
                            const isFixed = period?.teacher === 'Hoạt động';
                            
                            return (
                              <TableCell key={`${day}-morning-${idx}`} className="p-1">
                                <div id={`cell-${day}-${idx + 1}`}>
                                  <ScheduleCell
                                    day={day}
                                    period={idx + 1}
                                    periodData={period || { period: idx + 1, subject: '', teacher: '' }}
                                    onEdit={handleEditPeriod}
                                    isFixed={isFixed}
                                  />
                                </div>
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
                            const isFixed = period?.teacher === 'Hoạt động';
                            
                            return (
                              <TableCell key={`${day}-afternoon-${idx}`} className="p-1">
                                <div id={`cell-${day}-${periodIdx + 1}`}>
                                  <ScheduleCell
                                    day={day}
                                    period={periodIdx + 1}
                                    periodData={period || { period: periodIdx + 1, subject: '', teacher: '' }}
                                    onEdit={handleEditPeriod}
                                    isFixed={isFixed}
                                  />
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeId ? (
              <DraggableItem item={draggableItems.find(item => item.id === activeId)!} />
            ) : null}
          </DragOverlay>
        </DndContext>
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
                <Label htmlFor="item">Môn học / Hoạt động</Label>
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

export default OptimizedSchedule;

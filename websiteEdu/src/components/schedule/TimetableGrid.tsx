import { useState } from "react";
import { Period, Subject, Teacher, TimetableConfig } from "@/types/timetable";
import { TimetableCell } from "./TimetableCell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Edit, GripVertical } from "lucide-react";

interface TimetableGridProps {
  periods: Period[];
  subjects: Subject[];
  teachers: Teacher[];
  config: TimetableConfig;
  onUpdatePeriods: (periods: Period[]) => void;
  onEditPeriod?: (day: number, period: number) => void;
  onGenerateSchedule?: (grades: string[], year: string, semester: string) => Promise<void>;
  classes?: any[];
  selectedYear?: string;
  selectedSemester?: string;
}

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export const TimetableGrid = ({
  periods,
  subjects,
  teachers,
  config,
  onUpdatePeriods,
  onEditPeriod,
  onGenerateSchedule,
  classes = [],
  selectedYear = '',
  selectedSemester = '1'
}: TimetableGridProps) => {
  const [dragSource, setDragSource] = useState<{ day: number; period: number } | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [year, setYear] = useState(selectedYear);
  const [semester, setSemester] = useState(selectedSemester);
  const [isGenerating, setIsGenerating] = useState(false);

  const getPeriod = (day: number, period: number) => {
    return periods.find((p) => p.day === day && p.period === period);
  };

  const getSubject = (subjectId: string | null) => {
    return subjects.find((s) => s.id === subjectId) || null;
  };

  const getTeacher = (teacherId: string | null) => {
    return teachers.find((t) => t.id === teacherId) || null;
  };

  const handleDragStart = (day: number, period: number) => {
    setDragSource({ day, period });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetDay: number, targetPeriod: number) => {
    if (!dragSource) return;

    const newPeriods = [...periods];
    const sourceIndex = newPeriods.findIndex(
      (p) => p.day === dragSource.day && p.period === dragSource.period
    );
    const targetIndex = newPeriods.findIndex(
      (p) => p.day === targetDay && p.period === targetPeriod
    );

    if (sourceIndex !== -1 && targetIndex !== -1) {
      // Swap subjects and teachers
      const tempSubject = newPeriods[sourceIndex].subjectId;
      const tempTeacher = newPeriods[sourceIndex].teacherId;
      
      newPeriods[sourceIndex].subjectId = newPeriods[targetIndex].subjectId;
      newPeriods[sourceIndex].teacherId = newPeriods[targetIndex].teacherId;
      
      newPeriods[targetIndex].subjectId = tempSubject;
      newPeriods[targetIndex].teacherId = tempTeacher;
      
      onUpdatePeriods(newPeriods);
    }

    setDragSource(null);
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

  const morningPeriods = config.days.mon.morningPeriods;
  const afternoonPeriods = config.days.mon.afternoonPeriods;

  const renderSession = (sessionType: "morning" | "afternoon") => {
    const startPeriod = sessionType === "morning" ? 0 : morningPeriods;
    const endPeriod = sessionType === "morning" ? morningPeriods : morningPeriods + afternoonPeriods;

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-7 gap-2 mb-2">
            <div className="font-semibold text-center p-2">Tiết</div>
            {DAYS.map((day) => (
              <div key={day} className="font-semibold text-center p-2 bg-primary/10 rounded-lg">
                {day}
              </div>
            ))}
          </div>

          {Array.from({ length: endPeriod - startPeriod }).map((_, index) => {
            const periodIndex = startPeriod + index;
            return (
              <div key={periodIndex} className="grid grid-cols-7 gap-2 mb-2">
                <div className="flex items-center justify-center font-medium bg-muted rounded-lg">
                  {periodIndex + 1}
                </div>
                {DAYS.map((_, dayIndex) => {
                  const period = getPeriod(dayIndex, periodIndex);
                  const subject = period ? getSubject(period.subjectId) : null;
                  const teacher = period ? getTeacher(period.teacherId) : null;
                  const isFixed = period?.isFixed || false;
                  
                  return (
                    <TimetableCell
                      key={`${dayIndex}-${periodIndex}`}
                      subject={subject}
                      teacher={teacher}
                      day={dayIndex}
                      period={periodIndex}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onEdit={onEditPeriod}
                      isDragging={
                        dragSource?.day === dayIndex && dragSource?.period === periodIndex
                      }
                      isFixed={isFixed}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Thời khóa biểu</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowGenerateDialog(true)}
            disabled={!onGenerateSchedule}
          >
            <GripVertical className="h-4 w-4 mr-2" />
            Tạo TKB tự động
          </Button>
        </div>
      </div>

      <Tabs defaultValue="morning" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="morning">Buổi sáng (Tiết 1-{morningPeriods})</TabsTrigger>
          <TabsTrigger value="afternoon">Buổi chiều (Tiết {morningPeriods + 1}-{morningPeriods + afternoonPeriods})</TabsTrigger>
        </TabsList>
        <TabsContent value="morning">{renderSession("morning")}</TabsContent>
        <TabsContent value="afternoon">{renderSession("afternoon")}</TabsContent>
      </Tabs>

      {/* Dialog tạo thời khóa biểu */}
      {showGenerateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 p-6">
            <h3 className="text-lg font-semibold mb-4">Tạo thời khóa biểu tự động</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Năm học</label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2024-2025"
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Học kỳ</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="1">Học kỳ 1</option>
                  <option value="2">Học kỳ 2</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Chọn khối</label>
                <div className="space-y-2">
                  {getAvailableGrades().map(grade => (
                    <label key={grade} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedGrades.includes(grade)}
                        onChange={() => handleGradeToggle(grade)}
                        className="rounded"
                      />
                      <span>Khối {grade}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowGenerateDialog(false)}
                disabled={isGenerating}
              >
                Hủy
              </Button>
              <Button
                onClick={handleGenerateSchedule}
                disabled={selectedGrades.length === 0 || isGenerating}
              >
                {isGenerating ? 'Đang tạo...' : 'Tạo TKB'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
};

